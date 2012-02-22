# mnm

Make Node Module is a build tool for making native node.js modules.

## Installation

```bash
$ npm install mnm
```

## Quick Examples

```javascript
var builder = new Builder();

builder.appendUnique('CXXFLAGS', ['-fno-builtin']);
builder.appendIncludeDir('src/');
builder.appendSourceDir('./src');
builder.target = "mynativemodule_bindings";

builder.run();
```

## Realworld Examples

 * [node-java](https://github.com/nearinfinity/node-java) - A node.js to Java bridge.
 * [node-shark](https://github.com/nearinfinity/node-shark) - Wrapper around libwireshark providing network packet dissection.
 * [node-oracle](https://github.com/nearinfinity/node-oracle) - node.js driver to connect with an oracle database.

# Index

## command line arguments
 * [-v](#cmdline_verbose) - Verbose
 * [-Wall](#cmdline_showWarnings) - Show Warnings

## builder
 * [appendLinkerLibrary](#builder_appendLinkerLibrary)
 * [appendLinkerSearchDir](#builder_appendLinkerSearchDir)
 * [appendIncludeDir](#builder_appendIncludeDir)
 * [appendUnique](#builder_appendUnique)
 * [appendSourceDir](#builder_appendSourceDir)
 * [appendSource](#builder_appendSource)
 * [compile](#builder_compile)
 * [link](#builder_link)
 * [compileAndLink](#builder_compileAndLink)
 * [run](#builder_run)

# API Documentation

<a name="cmdline"/>
## command line

<a name="cmdline_verbose" />
### verbose -v or --verbose

Prints the command lines being executed along with other verbose output.

<a name="cmdline_showWarnings" />
### -Wall or --showWarnings

Adds the -Wall flag to the compile and prints all compiler warnings.

<a name="builder"/>
## builder

<a name="builder_appendLinkerLibrary" />
### builder.appendLinkerLibrary(libname)

Adds a library to the linker.

__Arguments__

 * libname - The name of the library to add. This string should not contain the lib prefix or the extension.

__Example__

    builder.appendLinkerLibrary('ssl');

<a name="builder_appendLinkerSearchDir" />
### builder.appendLinkerSearchDir(dir)

Adds a library to the linker search path.

__Arguments__

 * dir - The directory to add to the search path.

__Example__

    builder.appendLinkerSearchDir('/usr/local/lib');

<a name="builder_appendIncludeDir" />
### builder.appendIncludeDir(dir)

Adds a path to the list of include search directories.

__Arguments__

 * dir - The directory to add to the search path.

__Example__

    builder.builder_appendIncludeDir('/src');

<a name="builder_appendUnique" />
### builder.appendUnique(flagGroup, flags)

Adds a flag or flags to a flag group.

__Arguments__

 * flagGroup - The flag group to add the flags to. This should be LINKFLAGS or CXXFLAGS.
 * flags - A single string or array of strings to add to the group.

__Example__

    builder.appendUnique('CXXFLAGS', '-Wall');
    builder.appendUnique('CXXFLAGS', ['-Idir1', '-Idir2']);

<a name="builder_appendSourceDir" />
### builder.appendSourceDir(dir)

Adds a source code directory to the list of compilable items. All files with the extensions cpp, c, cxx will be added to the compile step.

__Arguments__

 * dir - The path to the directory containing the source files.

__Example__

    builder.appendSourceDir('./src');

<a name="builder_appendSource" />
### builder.appendSource(fileName)

Adds a single source file to the list of compilable items.

__Arguments__

 * fileName - The name of the file to compile.

__Example__

    builder.appendSource('./src/myModule.cpp');

<a name="builder_compile" />
### builder.compile([callback])

Performs the compile.

__Arguments__

 * callback (optional) - An optional callback to be called when the compile is complete.

__Example__

    builder.compile();

<a name="builder_link" />
### builder.link([callback])

Performs the link.

__Arguments__

 * callback (optional) - An optional callback to be called when the link is complete.

__Example__

    builder.link();

<a name="builder_compileAndLink" />
### builder.compileAndLink([callback])

Performs the compile and link.

__Arguments__

 * callback (optional) - An optional callback to be called when the compile and link is complete.

__Example__

    builder.compileAndLink();

<a name="builder_run" />
### builder.run([options], [callback])

Run the builder. If no options are specified will use command line arguments to determine what to do.

__Arguments__

 * options (optional) - An object containing the following options
  * verbose - true to be verbose
  * showWarnings - true to show all compiler warnings
  * action - set to one of the following actions
   * build - compile and link the project
   * compile - just perform the compile step.
   * link - just perform the link step.
 * callback (optional) - An optional callback to be called when the run is complete.

__Example__

    builder.compileAndLink();

## License

(The MIT License)

Copyright (c) 2012 Near Infinity Corporation

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
