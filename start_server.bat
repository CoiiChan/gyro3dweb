@echo off
REM 这里我仅举个例子 发布网页的方法非常多
REM Here is just one example. There are many ways to publish web pages
cd /d S:\svn_project\gyro3dweb
"D:\yourpythonpath\python.exe" -m http.server 8000
pause
