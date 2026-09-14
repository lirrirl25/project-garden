Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
shell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd.exe /c """ & fso.BuildPath(shell.CurrentDirectory, "Launch Project Garden.cmd") & """", 0, False
