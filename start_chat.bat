@echo off
title Bubble Chat Launcher
echo =========================================
echo  MENJALANKAN BUBBLE CHAT OVERLAY SERVER
echo =========================================
echo.
echo Memulai server di background...

:: Jalankan node server.cjs dalam kondisi minimized agar tidak mengganggu layar
start /min cmd /c "node server.cjs"

:: Tunggu 2 detik agar server siap
timeout /t 2 /nobreak >nul

echo Membuka Dashboard Pengaturan...
start http://localhost:3000/settings

echo.
echo Server telah berjalan!
echo Untuk mematikan server, tutup jendela CMD "node server.cjs" di taskbar Anda.
echo.
pause
exit
