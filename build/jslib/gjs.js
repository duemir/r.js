/*jslint strict:false */
/*global require: false imports: false */

(function () {
    require.load = function (context, moduleName, url) {
        // TODO: Relies on definitions in x.js, rewrite.
        exec(readFile(url));

        // Support anonymous modules.
        context.completeLoad(moduleName);
    };
}());
