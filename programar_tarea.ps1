# Script para programar la organización automática de Downloads
# Se ejecutará todos los domingos a las 7:00 AM

$action = New-ScheduledTaskAction -Execute "python.exe" -Argument "C:\Users\gonza\claude-projects\organize_downloads_auto.py" -WorkingDirectory "C:\Users\gonza\claude-projects"

$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 7:00AM

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName "OrganizarDownloads" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Organiza archivos de Downloads todos los domingos a las 7:00 AM" -Force

Write-Host "Tarea programada creada exitosamente!" -ForegroundColor Green
Write-Host "La organizacion de Downloads se ejecutara todos los domingos a las 7:00 AM" -ForegroundColor Cyan
