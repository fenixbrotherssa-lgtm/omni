; ============================================================
;  installer.nsh – personalización del instalador NSIS (electron-builder)
;  CasRodsoft Development
;
;  Reemplaza la verificación "la app está abierta" de electron-builder.
;  La original solo cierra procesos del usuario actual y SIN elevación:
;  si OMNI CORE quedó abierta "como administrador" (o un proceso colgado)
;  no la puede matar y se queda en el bucle "no se puede cerrar ->
;  Reintentar" sin salida. Esta versión:
;    1. pide cierre normal, luego fuerza el cierre (árbol completo);
;    2. si sigue viva, la cierra con permisos de administrador (UAC);
;    3. solo si aun así no se pudo, muestra Reintentar/Cancelar.
; ============================================================

; ¿Hay algún proceso OMNI CORE.exe? -> _ERR = 0 si lo hay.
!macro _OMNI_FIND_APP _ERR
  nsExec::Exec `$SYSDIR\cmd.exe /c tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /NH | $SYSDIR\find.exe /I "${APP_EXECUTABLE_FILENAME}"`
  Pop ${_ERR}
!macroend

!macro customCheckAppRunning
  !insertmacro _OMNI_FIND_APP $R0
  ${If} $R0 == 0
    DetailPrint `Cerrando "${PRODUCT_NAME}"...`
    nsExec::Exec `$SYSDIR\taskkill.exe /im "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    StrCpy $R1 0
    ${Do}
      Sleep 1000
      !insertmacro _OMNI_FIND_APP $R0
      ${If} $R0 != 0
        ${Break}
      ${EndIf}
      IntOp $R1 $R1 + 1
      nsExec::Exec `$SYSDIR\taskkill.exe /f /t /im "${APP_EXECUTABLE_FILENAME}"`
      Pop $R0
      ${If} $R1 == 3
        ; Sigue viva: casi seguro abierta como administrador -> cerrar elevado.
        DetailPrint `Cerrando "${PRODUCT_NAME}" con permisos de administrador...`
        ExecShellWait "runas" "$SYSDIR\taskkill.exe" `/f /t /im "${APP_EXECUTABLE_FILENAME}"` SW_HIDE
      ${EndIf}
      ${If} $R1 >= 6
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "No se pudo cerrar ${PRODUCT_NAME}.$\r$\n$\r$\nAbre el Administrador de tareas (Ctrl+Shift+Esc), pestaña Detalles, finaliza todos los procesos $\"${APP_EXECUTABLE_FILENAME}$\" y pulsa Reintentar." /SD IDCANCEL IDRETRY +2
        Quit
        StrCpy $R1 2
      ${EndIf}
    ${Loop}
  ${EndIf}
!macroend

; El desinstalador de la versión ANTERIOR (que trae su propia verificación,
; la vieja) puede fallar -> electron-builder mostraba "Fallo al desinstalar
; archivos antiguos de la aplicación" y abortaba. No es necesario abortar:
; la app ya está cerrada y los archivos nuevos se copian encima.
!macro _OMNI_UNINSTALL_CHECK
  ${If} $R0 != 0
    DetailPrint `Desinstalador anterior devolvió $R0; se continúa sobrescribiendo.`
    nsExec::Exec `$SYSDIR\taskkill.exe /f /t /im "${APP_EXECUTABLE_FILENAME}"`
    Pop $R1
    Sleep 1000
  ${EndIf}
!macroend
!macro customUnInstallCheck
  !insertmacro _OMNI_UNINSTALL_CHECK
!macroend
!macro customUnInstallCheckCurrentUser
  !insertmacro _OMNI_UNINSTALL_CHECK
!macroend
