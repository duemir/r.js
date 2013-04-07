/*global doh: false imports: false */

doh.debug = print;

// Override the doh._report method to make it quit with an 
// appropriate exit code in case of test failures.
(function(){
    var oldReport = doh._report;
    doh._report = function(){
        oldReport.apply(doh, arguments);
        if (this._failureCount > 0 ||this._errorCount > 0) {
            // Was added in version 1.35.9
            if (imports.system.exit) {
                imports.system.exit(0);
            }
        }
    };
})();
