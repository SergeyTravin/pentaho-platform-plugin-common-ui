/*!
 * Copyright 2010 - 2016 Pentaho Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
define([
  "pentaho/type/Context",
  "pentaho/type/changes/TransactionScope",
  "pentaho/type/changes/Transaction",
  "tests/pentaho/util/errorMatch"
], function(Context, TransactionScope, Transaction, errorMatch) {

  "use strict";

  /* global describe:false, it:false, expect:false, beforeEach:false, afterEach:false, jasmine:false */

  describe("pentaho.type.changes.TransactionScope", function() {

    describe("new(context, transaction)", function() {
      it("should be defined", function () {
        expect(typeof TransactionScope).toBeDefined();
      });
    });

    describe("#canCommit", function() {

      it("should return true if txn and scope just created", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        expect(scope.canCommit).toBe(true);

        scope.exit();
      });

      it("should return false if scope not exited but not current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope1 = new TransactionScope(context, txn);
        var scope2 = new TransactionScope(context, txn);

        expect(scope1.canCommit).toBe(false);

        scope2.exit();
        scope1.exit();
      });

      it("should return false if scope exited", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        scope.exit();

        expect(scope.canCommit).toBe(false);
      });

      it("should return false if scope is current but is not root", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope1 = new TransactionScope(context, txn);
        var scope2 = new TransactionScope(context, txn);

        expect(scope2.isRoot).toBe(false);
        expect(scope2.canCommit).toBe(false);

        scope2.exit();
        scope1.exit();
      });
    });

    describe("#using(fun, ctx)", function() {
      var context, txn, scope;

      beforeEach(function() {
        context = new Context();
        txn = new Transaction(context);
        scope = new TransactionScope(context, txn);
      });

      afterEach(function() {
        if(scope) {
          scope.exit();
          scope = null;
        }
        txn = null;
        context = null;
      });

      it("should call the specified function", function() {
        var fun = jasmine.createSpy("using-fun");
        scope.using(fun);

        scope = null;

        expect(fun).toHaveBeenCalled();
      });

      it("should call the specified function with the specified JS context", function() {
        var fun = jasmine.createSpy("using-fun");
        var jsCtx = {};
        scope.using(fun, jsCtx);

        scope = null;

        expect(fun.calls.first().object).toBe(jsCtx);
      });

      it("should call the specified function with the scope as argument", function() {
        var fun = jasmine.createSpy("using-fun");
        scope.using(fun);

        expect(fun.calls.first().args[0]).toBe(scope);

        scope = null;
      });

      it("should call scope.dispose when the specified function returns without error", function() {
        var fun = function() {};
        spyOn(scope, "dispose").and.callThrough();
        scope.using(fun);

        expect(scope.dispose).toHaveBeenCalled();

        scope = null;
      });

      it("should call scope.dispose when the specified function throws an error", function() {
        var ex  = new Error();
        var fun = function() { throw ex; };
        spyOn(scope, "dispose").and.callThrough();

        try {
          scope.using(fun);
        } catch(e) {
          if(e !== ex) throw e;
          /* else swallow thrown error */
        }

        expect(scope.dispose).toHaveBeenCalled();

        scope = null;
      });

      it("should call scope.reject with the error thrown by the specified function, if scope is current", function() {
        var ex  = new Error();
        var fun = function() { throw ex; };
        spyOn(scope, "reject").and.callThrough();

        try {
          scope.using(fun);
        } catch(e) {
          if(e !== ex) throw e;
          /* else swallow thrown error */
        }

        expect(scope.reject).toHaveBeenCalledWith(ex);

        scope = null;
      });

      it("should not call reject, if the specified function throws an error but scope is not current",
      function() {
        var ex  = new Error();
        var fun = function() {
          scope.exit();
          throw ex;
        };
        spyOn(scope, "reject").and.callThrough();

        try {
          scope.using(fun);
        } catch(e) {
          if(e !== ex) throw e;
          /* else swallow thrown error */
        }

        expect(scope.reject).not.toHaveBeenCalled();

        scope = null;
      });

      it("should throw back the error thrown by the specified function", function() {
        var ex  = new Error();
        var fun = function() { throw ex; };

        expect(function() {
          scope.using(fun);
        }).toThrow(ex);

        scope = null;
      });

      it("should return the value returned by the specified function", function() {
        var result = {};
        var fun = function() {
          return result;
        };

        var result2 = scope.using(fun);

        expect(result2).toBe(result);

        scope = null;
      });

      it("should throw back the transaction rejection error if it was not thrown by the specified function",
      function() {

        var ex = new Error();

        var fun = function() {
          // reject but swallow rejection error
          try {
            scope.reject(ex);
          } catch(e) {
            expect(e).toBe(ex);
          }
        };

        expect(function() {
          scope.using(fun);
        }).toThrow(ex);

        expect(scope.transaction.result.error).toBe(ex);

        scope = null;
      });
    });

    describe("#acceptWill()", function() {

      it("should call txn _preview if current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        spyOn(txn, "_commitWill");

        scope.acceptWill();

        expect(txn._commitWill).toHaveBeenCalled();
        scope.exit();
      });

      it("should call txn _preview and return its value if current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);
        var result = {};
        spyOn(txn, "_commitWill").and.returnValue(result);

        var result2 = scope.acceptWill();

        expect(result2).toBe(result);

        scope.exit();
      });

      it("should throw if scope not exited but not current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope1 = new TransactionScope(context, txn);
        var scope2 = new TransactionScope(context, txn);

        expect(function() {
          scope1.acceptWill();
        }).toThrow(errorMatch.operInvalid());

        scope2.exit();
        scope1.exit();
      });

      it("should throw if scope exited", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        scope.exit();

        expect(function() {
          scope.acceptWill();
        }).toThrow(errorMatch.operInvalid());
      });
    });

    describe("#reject(reason)", function() {

      it("should call txn _reject if current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        spyOn(txn, "_reject");

        scope.reject();

        expect(txn._reject).toHaveBeenCalled();
        scope.exit();
      });

      it("should call txn _reject with the given reason, if current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);
        var reason = {};
        spyOn(txn, "_reject");

        scope.reject(reason);

        expect(txn._reject).toHaveBeenCalledWith(reason);

        scope.exit();
      });

      it("should call txn _reject and throw its error, if current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);
        var ex = new Error();
        spyOn(txn, "_reject").and.callFake(function() { throw ex; });

        expect(function() {
          scope.reject();
        }).toThrow(ex);

        scope.exit();
      });

      it("should throw if scope not exited but not current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope1 = new TransactionScope(context, txn);
        var scope2 = new TransactionScope(context, txn);

        expect(function() {
          scope1.reject();
        }).toThrow(errorMatch.operInvalid());

        scope2.exit();
        scope1.exit();
      });

      it("should throw if scope exited", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        scope.exit();

        expect(function() {
          scope.reject();
        }).toThrow(errorMatch.operInvalid());
      });
    });

    describe("#accept()", function() {

      it("should call txn _commit if current and root", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        spyOn(txn, "_commit");

        scope.accept();

        expect(txn._commit).toHaveBeenCalled();
        scope.exit();
      });

      it("should return this, if current and root", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        var result = scope.accept();

        expect(result).toBe(scope);
      });

      it("should not call txn _commit and should simply call exit if cannot commit", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope1 = new TransactionScope(context, txn);
        var scope2 = new TransactionScope(context, txn);

        spyOn(scope2, "exit").and.callThrough();

        scope2.accept();

        expect(scope2.exit).toHaveBeenCalled();

        scope1.exit();
      });

      it("should throw if scope not exited but not current", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope1 = new TransactionScope(context, txn);
        var scope2 = new TransactionScope(context, txn);

        expect(function() {
          scope1.accept();
        }).toThrow(errorMatch.operInvalid());

        scope2.exit();
        scope1.exit();
      });

      it("should throw if scope exited", function() {

        var context = new Context();
        var txn = new Transaction(context);
        var scope = new TransactionScope(context, txn);

        scope.exit();

        expect(function() {
          scope.accept();
        }).toThrow(errorMatch.operInvalid());
      });
    });
  });
});
