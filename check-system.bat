@echo off
rem QalNet System Verification launcher.
rem Verifies prerequisites, builds, and configuration files.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-system.ps1"