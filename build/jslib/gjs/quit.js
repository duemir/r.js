/*global quit */
define(function () {
    'use strict';
    return function (code) {
        // 'exit' function is only available in version 1.35.9 of GJS
        var exit = imports.system.exit;
        return exit ? exit(code) : code;
    };
});
