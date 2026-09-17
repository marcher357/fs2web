
MESSAGE(STATUS "Configuring Emscripten (web) specific things and stuff...")

target_compile_definitions(platform INTERFACE SCP_UNIX USE_OPENAL PLATFORM_WEB)

set(PLATFORM_UNIX TRUE CACHE INTERNAL "" FORCE)
set(PLATFORM_EMSCRIPTEN TRUE CACHE INTERNAL "" FORCE)
