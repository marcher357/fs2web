// Emscripten's virtual filesystem is rooted at "/" by default, but the engine's own
// cfile_init() sanity check (code/cfile/cfile.cpp) refuses to run from a filesystem root.
// Give it a real working directory before main() runs -- this is also where packaged
// game data will eventually be mounted.
Module['preRun'] = Module['preRun'] || [];
Module['preRun'].push(function () {
	try {
		FS.mkdir('/freespace2');
	} catch (e) {
		// already exists
	}
	FS.chdir('/freespace2');
});
