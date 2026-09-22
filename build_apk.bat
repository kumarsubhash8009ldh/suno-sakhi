@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   SUNO SAKHI - ANDROID APK BUILD SYSTEM
echo ========================================================

set "JAVA_HOME=C:\Users\Subhash\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2"
set "ANDROID_HOME=C:\Users\Subhash\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo [1/4] Building Web Application...
cd /d "C:\Users\Subhash\.gemini\antigravity\scratch\suno-sakhi"
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Web build failed!
    exit /b %ERRORLEVEL%
)

echo [2/4] Syncing Assets with Capacitor Android...
call npx.cmd cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Capacitor sync failed!
    exit /b %ERRORLEVEL%
)

echo [3/4] Compiling Android APK with Gradle...
cd /d "C:\Users\Subhash\.gemini\antigravity\scratch\suno-sakhi\android"
if exist "app\build\outputs\apk\debug\app-debug.apk" del /f /q "app\build\outputs\apk\debug\app-debug.apk"
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gradle build failed!
    exit /b %ERRORLEVEL%
)

echo [4/4] Distributing Fresh APK...
cd /d "C:\Users\Subhash\.gemini\antigravity\scratch\suno-sakhi"
set "SRC_APK=android\app\build\outputs\apk\debug\app-debug.apk"

if exist "%SRC_APK%" (
    copy /y "%SRC_APK%" "Suno-Sakhi.apk" >nul
    copy /y "%SRC_APK%" "..\Suno-Sakhi.apk" >nul
    copy /y "%SRC_APK%" "public\suno-sakhi.apk" >nul
    copy /y "%SRC_APK%" "dist\suno-sakhi.apk" >nul
    echo.
    echo ========================================================
    echo   [SUCCESS] NEW APK BUILT SUCCESSFULLY!
    echo   Output Location: Suno-Sakhi.apk
    echo ========================================================
) else (
    echo [ERROR] Output APK not found at %SRC_APK%
    exit /b 1
)
