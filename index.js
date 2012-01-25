#!/usr/bin/env node

var path = require('path');
var util = require('util');
var fs = require('fs');
var childProcess = require('child_process');

function Builder() {
  this.flagGroups = {};
  this.target = "native_bindings";
  this.sourceFiles = [];
  this.verbose = false;
  this.showWarnings = false;
  this.cppCompiler = "g++";
  this.linker = "g++";
  this.objectFiles = [];

	if(process.platform == 'win32') {
		if(!process.env["VCINSTALLDIR"] && !process.env["VS100COMNTOOLS"]) {
			this.fail("You appear to not be running in a Visual Studio prompt.");
		}
	}

	if(process.platform == 'win32') {
		this.cppCompiler = "cl.exe";
		this.linker = "link.exe";
		this.nodeDir = process.env["NODE_HOME"];
	} else {
		this.nodeDir = process.env["NODE_HOME"] || path.join(process.execPath, '..', '..');
	}

	if(this.nodeDir) {
		this.nodeDir = this.trimQuotes(this.nodeDir);
		this.failIfNotExists(this.nodeDir, 'Node path "%s" not found, try setting NODE_HOME');
	} else {
		this.fail("You must specify NODE_HOME.");
	}

  for(var i=0; i<process.argv.length; i++) {
    var arg = process.argv[i];
    if(arg == '-v' || arg == '--verbose') {
      this.verbose = true;
    } else if(arg == '-Wall' || arg == '--showWarnings') {
      this.showWarnings = true;
    }
  }

	if(this.showWarnings) {
		builder.appendUnique('CXXFLAGS', ['-Wall']);
	}

	// process.execPath should equal node.
	if(process.platform == 'win32') {
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

  this.appendUnique('CXXFLAGS', [
    '-c',
    '-I' + this.nodeIncludeDir
  ]);

	if(process.platform == 'win32') {
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
  	  '-analyze-',
	    '-I' + this.v8IncludeDir,
	    '-I' + this.uvIncludeDir
    ]);
    this.appendUnique('LINKFLAGS', [
	    '-nologo',
	    '-dll',
			'-MANIFEST:NO',
			'-SUBSYSTEM:WINDOWS',
			'-TLBID:1',
			'-DYNAMICBASE',
			'-NXCOMPAT',
			'-MACHINE:X86',
	  ]);
	  this.appendLinkerLibrary('node');
	  this.appendLinkerLibrary('uv');
	  this.appendLinkerSearchDir(path.join(this.nodeLibDir, 'lib'));
	} else {
	  this.appendUnique('CXXFLAGS', [
	    '-D_LARGEFILE_SOURCE',
	    '-D_FILE_OFFSET_BITS=64',
	    '-D_GNU_SOURCE',
	    '-DPIC',
  	  '-g',
    	'-fPIC'
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

  this.appendLinkerSearchDir(this.nodeLibDir);
}

Builder.prototype.consoleGreen = function(msg) {
  process.stdout.write('\u001b[32m');
  process.stdout.write(msg);
  process.stdout.write('\u001b[0m');
}

Builder.prototype.consoleYellow = function(msg) {
  process.stdout.write('\u001b[33m');
  process.stdout.write(msg);
  process.stdout.write('\u001b[0m');
}

Builder.prototype.consoleRed = function(msg) {
  process.stdout.write('\u001b[31m');
  process.stdout.write(msg);
  process.stdout.write('\u001b[0m');
}

Builder.prototype.appendLinkerLibrary = function(lib) {
	var flag;
	if(process.platform == 'win32') {
		flag = lib + '.lib';
	} else {
		flag = '-l' + lib;
	}
	this.appendUnique('LINKFLAGS', flag);
}

Builder.prototype.appendLinkerSearchDir = function(dir) {
	var flag;
	if(process.platform == 'win32') {
		flag = '-LIBPATH:' + dir;
	} else {
		flag = '-L' + dir;
	}
	this.appendUnique('LINKFLAGS', flag);
}

Builder.prototype.getFlags = function(flagGroupName) {
  var flags = this.flagGroups[flagGroupName];
  if(!flags) {
    flags = this.flagGroups[flagGroupName] = [];
  }
  return flags;
}

Builder.prototype.appendUnique = function(flagGroupName, newFlags) {
  if(!(newFlags instanceof Array)) newFlags = [ newFlags ];
  var flags = this.getFlags(flagGroupName);

  for(var i=0; i<newFlags.length; i++) {
    if(flags.indexOf(newFlags[i]) == -1) {
      flags.push(newFlags[i]);
    }
  }
}

Builder.prototype.appendSource = function(fileName) {
  this.sourceFiles.push(fileName);
}

Builder.prototype.appendSourceDir = function(dirName) {
  var files = fs.readdirSync(dirName);
  for(var i=0; i<files.length; i++) {
    var fileName = files[i];
    if(fileName.match(/\.cpp$/) || fileName.match(/\.c$/) || fileName.match(/\.cxx$/)) {
      this.appendSource(path.join(dirName, fileName));
    }
  }
}

Builder.prototype.getCompilerArgs = function(fileName, outFileName) {
  fileName = path.resolve(fileName);
  this.createDir(path.dirname(outFileName));
  var args = [];
  var flags = this.getFlags('CXXFLAGS');
  args = args.concat(flags);
  args.push(fileName);
  if(process.platform == 'win32') {
  	args.push("-Fo" + outFileName);
  } else {
  	args.push("-o");
	  args.push(outFileName);
  }
  return args;
}

Builder.prototype.getLinkerArgs = function(outFileName) {
  this.createDir(path.dirname(outFileName));
  var args = [];
  var flags = this.getFlags('LINKFLAGS');
  args = args.concat(this.objectFiles);
  if(process.platform == 'win32') {
  	args.push("-out:" + outFileName);
  } else {
	  args.push("-o");
	  args.push(outFileName);
	}
  args = args.concat(flags);
  return args;
}

Builder.prototype.createDir = function(dirName) {
  var parent = path.dirname(dirName);
  if(!path.existsSync(parent)) {
    this.createDir(parent);
  }
  if(!path.existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }
}

Builder.prototype.run = function(cmd, args, callback) {
  var child = childProcess.spawn(cmd, args);
  child.stdout.on('data', function (data) {
    process.stdout.write(data);
  });
  child.stderr.on('data', function (data) {
    process.stderr.write(data);
  });
  child.on('exit', function(code) {
    callback(code);
  });
}

Builder.prototype._compile = function(curFileIdx, callback) {
  var self = this;
  var fileName = path.resolve(this.sourceFiles[curFileIdx]);
  var outFileName = path.join(this.ouputDir, path.relative(this.projectDir, fileName));
  outFileName = outFileName.replace(/\.cpp$/, '.o');
  this.objectFiles.push(outFileName);

  this.consoleGreen(util.format(
    "[%d/%d] cxx: %s -> %s\r\n",
    this.currentTask+1,
    this.totalTasks,
    path.relative(this.projectDir, fileName),
    path.relative(this.projectDir, outFileName)));
  var args = this.getCompilerArgs(fileName, outFileName);
  if(this.verbose) {
    console.log(this.cppCompiler, args.join(' '));
  }
  this.run(this.cppCompiler, args, function(code) {
    self.currentTask++;
    callback(code);
  });
}

Builder.prototype.compile = function(callback) {
  var self = this;
  this.createDir(this.ouputDir);

  if(this.sourceFiles.length == 0) {
    callback(new Error("Nothing to compile!"));
    return;
  }

  var curFileIdx = 0;
  var doCompile;
  var err = false;
  doCompile = function() {
    if(curFileIdx < self.sourceFiles.length) {
      self._compile(curFileIdx, function(code) {
        if(code != 0) {
          err = true;
        }
        curFileIdx++;
        doCompile();
      });
    } else {
      if(self.verbose) {
        console.log("Done compiling.");
      }
      if(err) {
        callback(new Error("At least one file failed to compile."));
      } else {
        callback();
      }
    }
  }
  doCompile();
}

Builder.prototype.link = function(callback) {
  var self = this;
  this.createDir(this.ouputDir);

  var outFileName = path.resolve(path.join(this.ouputDir, this.target + ".node"));
  this.consoleYellow(util.format(
    "[%d/%d] cxx_link: %s -> %s\r\n",
    this.currentTask+1,
    this.totalTasks,
    this.objectFiles.map(function(f) { return path.relative(self.projectDir, f); }).join(' '),
    path.relative(this.projectDir, outFileName)));

  var args = this.getLinkerArgs(outFileName);

  if(this.verbose) {
    console.log(this.linker, args.join(' '));
  }

  this.run(this.linker, args, function(code) {
    self.currentTask++;
    if(self.verbose) {
      console.log("Done linking.");
    }
    if(code != 0) {
      callback(new Error("Failed to link."));
    } else {
      callback();
    }
  });
}

Builder.prototype.compileAndLink = function(callback) {
  this.currentTask = 0;
  this.totalTasks = this.sourceFiles.length + 1; // +1 is for linking
  callback = callback || function() {};
  var self = this;
  this.compile(function(err) {
    if(err) { self.fail(err); return; }
    self.link(function(err) {
      if(err) { self.fail(err); return; }
      if(self.verbose) {
        console.log("Done.");
      }
      callback();
    });
  });
}

Builder.prototype.failIfNotExists = function(dirName, message) {
	dirName = path.resolve(dirName);
  if(!path.existsSync(dirName)) {
    message = message || "Could not find '%s'.";
    this.fail(message, dirName);
  }
}

Builder.prototype.fail = function(message) {
  if(message instanceof Error) {
    message = message.message;
  }
  var msg = util.format.apply(this, arguments);
  this.consoleRed("ERROR: " + msg + '\r\n');
  process.exit(1);
}

Builder.prototype.trimQuotes = function(str) {
	if(str) {
		str = str.replace(/^"/, '').replace(/"$/, '');
	}
	return str;
}

module.exports = Builder;

