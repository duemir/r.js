/**
 * @license RequireJS Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Helper functions to deal with file I/O.

/*jslint plusplus: false */
/*global imports: false, define: false */

define(['prim'], function (prim) {
    var GLib = imports.gi.GLib,
        Gio  = imports.gi.Gio;

    function frontSlash(path) {
        return path.replace(/\\/g, '/');
    }

    var file = {
        backSlashRegExp: /\\/g,
        exclusionRegExp: /^\./,
        getLineSeparator: function () {
            return '/';
        },

        exists: function (fileName) {
            return GLib.file_test(fileName, GLib.FileTest.EXISTS);
        },

        parent: function (fileName) {
            return Gio.File.new_for_path(fileName).get_parent().get_path();
        },

        /**
         * Gets the absolute file path as a string, normalized
         * to using front slashes for path separators.
         * @param {String} fileName
         */
        absPath: function (fileName) {
            return frontSlash(Gio.File.new_for_path(fileName).get_path());
        },

        normalize: function (fileName) {
            return file.absPath(fileName);
        },

        isFile: function (path) {
            return GLib.file_test(path, GLib.FileTest.REGULAR);
        },

        isDirectory: function (path) {
            return GLib.file_test(path, GLib.FileTest.DIR);
        },

        getFilteredFileList: function (/*String*/startDir, /*RegExp*/regExpFilters, /*boolean?*/makeUnixPaths, /*boolean?*/startDirIsGFile) {
            //summary: Recurses startDir and finds matches to the files that match regExpFilters.include
            //and do not match regExpFilters.exclude. Or just one regexp can be passed in for regExpFilters,
            //and it will be treated as the "include" case.
            //Ignores files/directories that start with a period (.) unless exclusionRegExp
            //is set to another value.
            var files = [], topDir, regExpInclude, regExpExclude, dirFileEnumeration,
                i, fileObj, fileType, filePath, ok, dirFiles;

            topDir = startDir;
            if (!startDirIsGFile) {
                topDir = Gio.File.new_for_path(startDir);
            }

            regExpInclude = regExpFilters.include || regExpFilters;
            regExpExclude = regExpFilters.exclude || null;

            if (topDir.query_exists(null)) {
                dirFileEnumeration = topDir.enumerate_children('standard::name,standard::type', null, null);
                fileObj = dirFileEnumeration.next_file(null);
                while (fileObj) {
                    fileType = fileObj.get_file_type();
                    if (fileType === Gio.FileType.REGULAR) {
                        filePath = topDir.get_child(fileObj.get_name()).get_path();
                        if (makeUnixPaths) {
                            //Make sure we have a JS string.
                            if (filePath.indexOf("/") === -1) {
                                filePath = frontSlash(filePath);
                            }
                        }

                        ok = true;
                        if (regExpInclude) {
                            ok = filePath.match(regExpInclude);
                        }
                        if (ok && regExpExclude) {
                            ok = !filePath.match(regExpExclude);
                        }

                        if (ok && (!file.exclusionRegExp ||
                            !file.exclusionRegExp.test(fileObj.get_name()))) {
                            files.push(filePath);
                        }
                    } else if (fileType === Gio.FileType.DIRECTORY &&
                              (!file.exclusionRegExp || !file.exclusionRegExp.test(fileObj.get_name()))) {
                        dirFiles = this.getFilteredFileList(topDir.get_child(fileObj.get_name()), regExpFilters, makeUnixPaths, true);
                        files.push.apply(files, dirFiles);
                    }
                    fileObj = dirFileEnumeration.next_file(null);
                }
                dirFileEnumeration.close(null);
            }

            return files; //Array
        },

        copyDir: function (/*String*/srcDir, /*String*/destDir, /*RegExp?*/regExpFilter, /*boolean?*/onlyCopyNew) {
            //summary: copies files from srcDir to destDir using the regExpFilter to determine if the
            //file should be copied. Returns a list file name strings of the destinations that were copied.
            regExpFilter = regExpFilter || /\w/;

            var fileNames = file.getFilteredFileList(srcDir, regExpFilter, true),
            copiedFiles = [], i, srcFileName, destFileName;

            for (i = 0; i < fileNames.length; i++) {
                srcFileName = fileNames[i];
                destFileName = srcFileName.replace(srcDir, destDir);

                if (file.copyFile(srcFileName, destFileName, onlyCopyNew)) {
                    copiedFiles.push(destFileName);
                }
            }

            return copiedFiles.length ? copiedFiles : null; //Array or null
        },

        copyFile: function (/*String*/srcFileName, /*String*/destFileName, /*boolean?*/onlyCopyNew) {
            //summary: copies srcFileName to destFileName. If onlyCopyNew is set, it only copies the file if
            //srcFileName is newer than destFileName. Returns a boolean indicating if the copy occurred.
            var parentDir,
                srcFile = Gio.File.new_for_path(srcFileName),
                destFile = Gio.File.new_for_path(destFileName);

            //logger.trace("Src filename: " + srcFileName);
            //logger.trace("Dest filename: " + destFileName);

            //If onlyCopyNew is true, then compare dates and only copy if the src is newer
            //than dest.
            /*if (onlyCopyNew) {
                if (destFile.query_exists(null) && fs.statSync(destFileName).mtime.getTime() >= fs.statSync(srcFileName).mtime.getTime()) {
                    return false; //Boolean
                }
            }*/

            //Make sure destination dir exists.
            parentDir = destFile.get_parent();
            if (!parentDir.query_exists(null)) {
                parentDir.make_directory_with_parents(null);
            }

            srcFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);

            return true; //Boolean
        },

        /**
         * Renames a file. May fail if "to" already exists or is on another drive.
         */
        renameFile: function (from, to) {
            if (to.indexOf('/') !== -1) {
                to = to.split('/').pop();
            }
            Gio.File.new_for_path(from).set_display_name(to, null);
        },

        readFile: function (/*String*/path, /*String?*/encoding) {
            //A file read function that can deal with BOMs
            encoding = encoding || "utf-8";
            var file = Gio.File.new_for_path(path),
                contents = file.load_contents(null);
            if (contents[0]) {
                // not sure whether encoding must be upper case
                return contents[1].toString(encoding.toUpperCase());
            } else {
                // it is only a guess :(
                throw contents[3];
            }
        },

        readFileAsync: function (path, encoding) {
            var d = prim();
            try {
                d.resolve(file.readFile(path, encoding));
            } catch (e) {
                d.reject(e);
            }
            return d.promise;
        },

        saveUtf8File: function (/*String*/fileName, /*String*/fileContents) {
            //summary: saves a file using UTF-8 encoding.
            file.saveFile(fileName, fileContents, "utf-8");
        },

        saveFile: function (/*String*/fileName, /*String*/fileContents, /*String?*/encoding) {
            //summary: saves a file.
            var outFile = Gio.File.new_for_path(fileName), os, dos;

            parentDir = outFile.get_parent();
            if (!parentDir.query_exists(null)) {
                if (!parentDir.make_directory_with_parents(null)) {
                    throw "Could not create directory: " + parentDir.get_path();
                }
            }

            if (outFile.query_exists(null)) {
                os = outFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
            } else {
                os = outFile.create(Gio.FileCreateFlags.NONE, null);
            }
            dos = Gio.DataOutputStream['new'](os);
            dos.put_string(fileContents, null);
            dos.close(null);
        },

        deleteFile: function (/*String|Gio.File*/fileName) {
            //summary: deletes a file or directory if it exists.
            var fileObj = fileName, files, file;
            if (typeof fileName === 'string') {
                fileObj = Gio.File.new_for_path(fileName);
            }
            if (fileObj.query_exists(null)) {
                if (fileObj.query_file_type(Gio.FileQueryInfoFlags.NONE, null) === Gio.FileType.DIRECTORY) {
                    files = fileObj.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
                    file = files.next_file(null);
                    while (file) {
                        this.deleteFile(fileObj.get_child(file.get_name()));
                        file = files.next_file(null);
                    }
                    files.close(null);
                }
                fileObj['delete'](null);
            }
        },

        /**
         * Deletes any empty directories under the given directory.
         */
        deleteEmptyDirs: function (startDir, startDirIsGjsFile) {
            var topDir = startDir,
                dirFileEnum, i, fileObj;

            if (!startDirIsGjsFile) {
                topDir = Gio.File.new_for_path(startDir);
            }

            if (topDir.query_exists(null)) {
                dirFileEnum = topDir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
                fileObj = dirFileEnum.next_file(null);
                while (fileObj) {
                    if (fileObj.get_file_type() === Gio.FileType.DIRECTORY) {
                        file.deleteEmptyDirs(topDir.get_child(fileObj.get_name()), true);
                    }
                    fileObj = dirFileEnum.next_file(null);
                }
                dirFileEnum.close(null);

                //If the directory is empty now, delete it.
                //GIO won't delete directory if it is not empty.
                topDir['delete'](null);
            }
        }
    };

    return file;
});
