!macro KIWI_CONTROL_DETERMINE_INSTALL_SCOPE OUTVAR
  StrCpy ${OUTVAR} "machine"

  StrLen $R8 "$LOCALAPPDATA"
  StrCpy $R9 "$INSTDIR" $R8
  StrCmp $R9 "$LOCALAPPDATA" 0 +2
    StrCpy ${OUTVAR} "user"

  StrLen $R8 "$PROFILE"
  StrCpy $R9 "$INSTDIR" $R8
  StrCmp $R9 "$PROFILE" 0 +2
    StrCpy ${OUTVAR} "user"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro KIWI_CONTROL_DETERMINE_INSTALL_SCOPE $R0
  StrCpy $R3 "$INSTDIR\resources\desktop\cli-bundle\install.ps1"
  StrCpy $R4 "$INSTDIR\resources\desktop\node\node.exe"
  IfFileExists "$R3" kiwi_postinstall_found 0
  StrCpy $R3 "$INSTDIR\resources\resources\desktop\cli-bundle\install.ps1"
  StrCpy $R4 "$INSTDIR\resources\resources\desktop\node\node.exe"
  IfFileExists "$R3" kiwi_postinstall_found 0
  StrCpy $R3 "$INSTDIR\desktop\cli-bundle\install.ps1"
  StrCpy $R4 "$INSTDIR\desktop\node\node.exe"
  IfFileExists "$R3" kiwi_postinstall_found 0
  StrCpy $R3 "$INSTDIR\cli-bundle\install.ps1"
  StrCpy $R4 "$INSTDIR\node\node.exe"
  IfFileExists "$R3" kiwi_postinstall_found 0

  DetailPrint "Kiwi Control terminal command setup script was not found in bundled resources."
  Abort

kiwi_postinstall_found:
  IfFileExists "$R4" kiwi_postinstall_prepare 0
  StrCpy $R4 ""

kiwi_postinstall_prepare:
  StrCpy $R1 "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
  IfFileExists "$R1" kiwi_postinstall_run 0
  StrCpy $R1 "powershell.exe"

kiwi_postinstall_run:
  ClearErrors
  ExecWait '"$R1" -NoProfile -ExecutionPolicy Bypass -File "$R3" -InstallScope "$R0" -PreferredNodePath "$R4"' $R2
  IntCmp $R2 0 kiwi_postinstall_done kiwi_postinstall_done kiwi_postinstall_failed

kiwi_postinstall_failed:
  DetailPrint "Kiwi Control terminal command setup failed during install (exit $R2)."
  Abort

kiwi_postinstall_done:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro KIWI_CONTROL_DETERMINE_INSTALL_SCOPE $R0
  StrCpy $R3 "$INSTDIR\resources\desktop\cli-bundle\uninstall.ps1"
  IfFileExists "$R3" kiwi_preuninstall_found 0
  StrCpy $R3 "$INSTDIR\resources\resources\desktop\cli-bundle\uninstall.ps1"
  IfFileExists "$R3" kiwi_preuninstall_found 0
  StrCpy $R3 "$INSTDIR\desktop\cli-bundle\uninstall.ps1"
  IfFileExists "$R3" kiwi_preuninstall_found 0
  StrCpy $R3 "$INSTDIR\cli-bundle\uninstall.ps1"
  IfFileExists "$R3" kiwi_preuninstall_found 0
  DetailPrint "Kiwi Control terminal command cleanup script was not found in bundled resources."
  Goto kiwi_preuninstall_done

kiwi_preuninstall_found:
  StrCpy $R1 "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
  IfFileExists "$R1" kiwi_preuninstall_run 0
  StrCpy $R1 "powershell.exe"

kiwi_preuninstall_run:
  ClearErrors
  ExecWait '"$R1" -NoProfile -ExecutionPolicy Bypass -File "$R3" -InstallScope "$R0"' $R2
  IntCmp $R2 0 kiwi_preuninstall_done kiwi_preuninstall_done kiwi_preuninstall_warn

kiwi_preuninstall_warn:
  DetailPrint "Kiwi Control terminal command cleanup exited with code $R2."

kiwi_preuninstall_done:
!macroend
