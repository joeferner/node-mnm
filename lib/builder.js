var path = require('path');
var util = require('util');
var fs = require('fs');
var childProcess = require('child_process');
var ansi = require("./ansi.js");

var existsSync = fs.existsSync || path.existsSync;
var isArray = Array.isArray;

function Builder () {
  this.flagGroups = {};
  this.target = "native_bindings";
  this.sourceFiles = [];
  this.verbose = false;
  this.showWarnings = false;
  this.cppCompiler = "g++";
  this.linker = "g++";
  this.objectFiles = [];

  if (process.platform == 'win32') {
    if (!process.env["VCINSTALLDIR"] && !process.env["VS100COMNTOOLS"]) {
      this.fail("You appear to not be running in a Visual Studio prompt.");
    }
  }

  if (process.platform == 'win32') {
    this.cppCompiler = "cl.exe";
    this.linker = "link.exe";
    this.nodeDir = process.env["NODE_HOME"];
  } else {
    this.nodeDir = process.env["NODE_HOME"] || path.join(process.execPath, '..', '..');
  }

  if (this.nodeDir) {
    this.nodeDir = this.trimQuotes(this.nodeDir);
    this.failIfNotExists(this.nodeDir, 'Node path "%s" not found, try setting NODE_HOME');
  } else {
    this.fail("You must specify NODE_HOME.");
  }

  // process.execPath should equal node.
  if (process.platform == 'win32') {
    this.nodeIncludeDir = path.join(this.nodeDir, 'src');
    this.v8IncludeDir = path.join(this.nodeDir, 'deps/v8/include');
    this.uvIncludeDir = path.join(this.nodeDir, 'deps/uv/include');
    this.nodeLibDir = path.join(this.nodeDir, 'Release');
  } else {

    this.nodeIncludeDir = path.join(this.nodeDir, 'include', 'node');
    this.nodeLibDir = path.join(this.nodeDir, 'lib');
  }
  this.projectDir = path.resolve('.');
  this.buildDir = path.resolve(this.projectDir, 'build');
  this.ouputDir = path.resolve(this.buildDir, 'Release');

  this.appendUnique('CXXFLAGS', '-c');

  if (process.platform == 'win32') {
    this.appendUnique('CXXFLAGS', [
      '-nologo',
      '-DWIN32',
      '-D_WINDOWS',
      '-D_WINDLL',
      '-EHsc',
      '-c',
      '-Oi-',
      '-Od',
      '-Gd',
      '-analyze-'
    ]);
    this.appendUnique('LINKFLAGS', [
      '-nologo',
      '-dll',
      '-MANIFEST:NO',
      '-SUBSYSTEM:WINDOWS',
      '-TLBID:1',
      '-DYNAMICBASE',
      '-NXCOMPAT',
      '-MACHINE:X86'
    ]);
    this.appendLinkerLibrary('node');
    this.appendLinkerLibrary('uv');
  } else {
    this.appendUnique('CXXFLAGS', [
      '-D_LARGEFILE_SOURCE',
      '-D_FILE_OFFSET_BITS=64',
      '-D_GNU_SOURCE',
      '-DPIC',
      '-g',
      '-fPIC',
      '-MD'
    ]);
    if (process.platform == 'darwin') {
      this.appendUnique('LINKFLAGS', [
        '-bundle',
        '-undefined',
        'dynamic_lookup'
      ]);
    } else {
      this.appendUnique('LINKFLAGS', [
        '-shared'
      ]);
    }
  }
}

Builder.prototype.appendLinkerLibrary = function (lib) {
  if (isArray(lib)) {
    return lib.forEach(this.appendLinkerLibrary.bind(this));
  }
  var flag;
  if (process.platform == 'win32') {
    flag = lib.replace(/(?:\.lib)?$/, '.lib');
  } else {
    flag = '-l' + lib;
  }
  this.appendUnique('LINKFLAGS', flag);
};

Builder.prototype.appendLinkerSearchDir = function (dir) {
  if (isArray(dir)) {
    return dir.forEach(this.appendLinkerSearchDir.bind(this));
  }
  var flag;
  if (process.platform == 'win32') {
    flag = '-LIBPATH:' + dir;
  } else {
    flag = '-L' + dir;
  }
  this.appendUnique('LINKFLAGS', flag);
};

Builder.prototype.appendIncludeDir = function (dir) {
  if (isArray(dir)) {
    return dir.forEach(this.appendIncludeDir.bind(this));
  }
  this.appendUnique('CXXFLAGS', '-I' + dir);
};

Builder.prototype.getFlags = function (flagGroupName) {
  var flags = this.flagGroups[flagGroupName];
  if (!flags) {
    flags = this.flagGroups[flagGroupName] = [];
  }
  return flags;
};

Builder.prototype.appendUnique = function (flagGroupName, newFlags) {
  newFlags = isArray(newFlags) ? newFlags : [newFlags];
  var flags = this.getFlags(flagGroupName);

  for (var i = 0; i < newFlags.length; i++) {
    if (flags.indexOf(newFlags[i]) == -1) {
      flags.push(newFlags[i]);
    }
  }
};

Builder.prototype.appendSource = function (fileName) {
  if (isArray(fileName)) {
    return fileName.forEach(this.appendSource.bind(this));
  }
  this.sourceFiles.push(fileName);
};

Builder.prototype.appendSourceDir = function (dirName) {
  if (isArray(dirName)) {
    return dirName.forEach(this.appendSourceDir.bind(this));
  }
  var files = fs.readdirSync(dirName);
  for (var i = 0; i < files.length; i++) {
    var fileName = files[i];
    if (fileName.match(/\.cpp$/) || fileName.match(/\.c$/) || fileName.match(/\.cxx$/)) {
      this.appendSource(path.join(dirName, fileName));
    }
  }
};

Builder.prototype.getCompilerArgs = function (fileName, outFileName) {
  fileName = path.resolve(fileName);
  this.createDir(path.dirname(outFileName));
  var args = [];
  var flags = this.getFlags('CXXFLAGS');
  args = args.concat(flags);
  args.push(fileName);
  if (process.platform == 'win32') {
    args.push("-Fo" + outFileName);
  } else {
    args.push("-o");
    args.push(outFileName);
  }
  return args;
};

Builder.prototype.getLinkerArgs = function (outFileName) {
  this.createDir(path.dirname(outFileName));
  var args = [];
  var flags = this.getFlags('LINKFLAGS');
  args = args.concat(this.objectFiles);
  if (process.platform == 'win32') {
    args.push("-out:" + outFileName);
  } else {
    args.push("-o");
    args.push(outFileName);
  }
  args = args.concat(flags);
  return args;
};

Builder.prototype.createDir = function (dirName) {
  var parent = path.dirname(dirName);
  if (!existsSync(parent)) {
    this.createDir(parent);
  }
  if (!existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }
};

Builder.prototype._runCommandLine = function (cmd, args, callback) {
  var child = childProcess.spawn(cmd, args);
  child.stdout.on('data', function (data) {
    process.stdout.write(data);
  });
  child.stderr.on('data', function (data) {
    process.stderr.write(data);
  });
  child.on('exit', function (code) {
    callback(code);
  });
};

Builder.prototype._flattenArray = function (arr) {
  var results = [];
  for (var i = 0; i < arr.length; i++) {
    results = results.concat(arr[i]);
  }
  return results;
};

Builder.prototype._parseDepFile = function (depData) {
  var deps = depData.split('\n').slice(1).map(function (item) {
    return item
      .replace(/ \\$/, '')
      .replace(/^ /, '')
      .split(' ');
  });
  deps = this._flattenArray(deps);
  deps = deps.filter(function (item) {
    return item.length > 0;
  });
  return deps;
};

Builder.prototype._getMaxTime = function (files) {
  var maxTime = new Date(1900);
  for (var i = 0; i < files.length; i++) {
    var stat = fs.statSync(files[i]);
    if (stat.mtime > maxTime) {
      maxTime = stat.mtime;
    }
  }
  return maxTime;
};

Builder.prototype._shouldCompile = function (outFileName, depFileName) {
  try {
    var depFiles = this._parseDepFile(fs.readFileSync(depFileName, 'ascii'));
    var outTime = this._getMaxTime([outFileName]);
    var maxDepTime = this._getMaxTime(depFiles);
    return outTime < maxDepTime;
  } catch (e) {
    //console.log(e);
    return true;
  }
};

Builder.prototype._shouldLink = function (outFileName, objectFiles) {
  try {
    var outTime = this._getMaxTime([outFileName]);
    var maxObjectFileTime = this._getMaxTime(objectFiles);
    return outTime < maxObjectFileTime;
  } catch (e) {
    //console.log(e);
    return true;
  }
};

Builder.prototype._compile = function (curFileIdx, callback) {
  var self = this;
  var fileName = path.resolve(this.sourceFiles[curFileIdx]);
  var outFileName = path.join(this.ouputDir, path.relative(this.projectDir, fileName));
  var outExt = process.platform == 'win32' ? '.obj' : '.o';
  outFileName = outFileName.replace(/\.cpp$/, outExt);
  var depFileName = outFileName.replace(new RegExp('\\' + outExt + '$'), '.d');
  this.objectFiles.push(outFileName);

  if (this._shouldCompile(outFileName, depFileName)) {
    console.log(ansi.green(util.format(
      "[%d/%d] cxx: %s -> %s",
      this.currentTask + 1,
      this.totalTasks,
      path.relative(this.projectDir, fileName),
      path.relative(this.projectDir, outFileName))));
    var args = this.getCompilerArgs(fileName, outFileName);
    if (this.verbose) {
      console.log(this.cppCompiler, args.join(' '));
    }
    this._runCommandLine(this.cppCompiler, args, function (code) {
      self.currentTask++;
      callback(code);
    });
  } else {
    console.log(ansi.green(util.format(
      "[%d/%d] SKIPPING cxx: %s -> %s",
      this.currentTask + 1,
      this.totalTasks,
      path.relative(this.projectDir, fileName),
      path.relative(this.projectDir, outFileName))));
    self.currentTask++;
    callback(0);
  }
};

Builder.prototype.compile = function (callback) {
  this.currentTask = this.currentTask || 0;
  this.totalTasks = this.totalTasks || this.sourceFiles.length;
  callback = callback || function () {};
  var self = this;
  this.createDir(this.ouputDir);

  // append this late because it could be set later in the process
  if (this.showWarnings) {
    this.appendUnique('CXXFLAGS', ['-Wall']);
  }

  // need to append these last to reduce conflicts
  this.appendIncludeDir(this.nodeIncludeDir);

  if (process.platform == 'win32') {
    this.appendIncludeDir(this.v8IncludeDir);
    this.appendIncludeDir(this.uvIncludeDir);
  }

  // no source then fail
  if (this.sourceFiles.length == 0) {
    callback(new Error("Nothing to compile!"));
    return;
  }

  var curFileIdx = 0;
  var doCompile;
  var err = false;
  doCompile = function () {
    if (curFileIdx < self.sourceFiles.length) {
      self._compile(curFileIdx, function (code) {
        if (code != 0) {
          err = true;
        }
        curFileIdx++;
        doCompile();
      });
    } else {
      if (self.verbose) {
        console.log("Done compiling.");
      }
      if (err) {
        callback(new Error("At least one file failed to compile."));
      } else {
        callback();
      }
    }
  };
  doCompile();
};

Builder.prototype.link = function (callback) {
  this.currentTask = this.currentTask || 0;
  this.totalTasks = this.totalTasks || 1;
  callback = callback || function () {};
  var self = this;
  this.createDir(this.ouputDir);

  var outFileName = path.resolve(path.join(this.ouputDir, this.target + ".node"));
  var objectFilesStr = this.objectFiles.map(
    function (f) { return path.relative(self.projectDir, f); }).join(' ');

  // append last to reduce conflict
  if (process.platform == 'win32') {
    this.appendLinkerSearchDir(path.join(this.nodeLibDir, 'lib'));
  }
  this.appendLinkerSearchDir(this.nodeLibDir);

  // do the linking
  if (this._shouldLink(outFileName, this.objectFiles)) {
    console.log(ansi.yellow(util.format(
      "[%d/%d] cxx_link: %s -> %s",
      this.currentTask + 1,
      this.totalTasks,
      objectFilesStr,
      path.relative(this.projectDir, outFileName))));

    var args = this.getLinkerArgs(outFileName);

    if (this.verbose) {
      console.log(this.linker, args.join(' '));
    }

    this._runCommandLine(this.linker, args, function (code) {
      self.currentTask++;
      if (self.verbose) {
        console.log("Done linking.");
      }
      if (code != 0) {
        callback(new Error("Failed to link."));
      } else {
        callback();
      }
    });
  } else {
    console.log(ansi.yellow(util.format(
      "[%d/%d] SKIPPING cxx_link: %s -> %s",
      this.currentTask + 1,
      this.totalTasks,
      objectFilesStr,
      path.relative(this.projectDir, outFileName))));
  }
};

Builder.prototype.compileAndLink = function (callback) {
  this.currentTask = 0;
  this.totalTasks = this.sourceFiles.length + 1; // +1 is for linking
  callback = callback || function () {};
  var self = this;
  this.compile(function (err) {
    if (err) {
      self.fail(err);
      return;
    }
    self.link(function (err) {
      if (err) {
        self.fail(err);
        return;
      }
      if (self.verbose) {
        console.log("Done.");
      }
      callback();
    });
  });
};

Builder.prototype.run = function (options, callback) {
  callback = callback || function () {};
  options = options || {};
  this.action = null;

  for (var i = 0; i < process.argv.length; i++) {
    var arg = process.argv[i];
    if (arg == '-v' || arg == '--verbose') {
      options.verbose = true;
    } else if (arg == '-Wall' || arg == '--showWarnings') {
      options.showWarnings = true;
    } else if (arg == 'build' || arg == 'compile' || arg == 'link' || arg == 'help') {
      options.action = arg;
    }
  }

  this.verbose = options.verbose;
  this.showWarnings = options.showWarnings;
  this.action = options.action;

  if (this.action == 'build') {
    this.compileAndLink(callback);
  } else if (this.action == 'compile') {
    this.compile(callback);
  } else if (this.action == 'link') {
    this.link(callback);
  } else if (this.action == 'help') {
    this.printHelp();
  } else {
    console.error(ansi.red("No action specified"));
    this.printHelp();
    callback(null);
  }
};

Builder.prototype.printHelp = function () {
  console.log("mnm [options] action");
  console.log("");
  console.log(" Actions");
  console.log("   build    Compile and link the native module");
  console.log("   compile  Only run the compiler step.");
  console.log("   link     Only run the linker step.");
  console.log("");
  console.log(" Options");
  console.log("   -v, --verbose          Print verbose messages.");
  console.log("   -Wall, --showWarnings  Show all compiler warnings.");
  console.log("");
};

Builder.prototype.failIfNotExists = function (dirName, message) {
  dirName = path.resolve(dirName);
  if (!existsSync(dirName)) {
    message = message || "Could not find '%s'.";
    this.fail(message, dirName);
  }
};

Builder.prototype.fail = function (message) {
  var msg = util.format.apply(this, arguments);
  console.error(ansi.red("ERROR: " + msg));
  process.exit(1);
};

Builder.prototype.trimQuotes = function (str) {
  if (str) {
    str = str.replace(/^"/, '').replace(/"$/, '');
  }
  return str;
};

module.exports = Builder;
