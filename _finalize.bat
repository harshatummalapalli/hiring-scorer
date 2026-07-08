@echo off
cd /d "C:\Users\harsh\OneDrive\Desktop\hiring-scorer"

echo === Removing temp file from git ===
git rm --cached _push_domain.bat 2>nul
del /f _push_domain.bat 2>nul

echo === Committing ===
git add -A
git commit -m "chore: remove temp push script"

echo === Pushing ===
git push origin security-ontology-extension

echo === Creating extension zip ===
powershell -Command "Compress-Archive -Path 'C:\Users\harsh\OneDrive\Desktop\hiring-scorer\kharta-extension\*' -DestinationPath 'C:\Users\harsh\OneDrive\Desktop\kharta-extension-v0.2.2.zip' -Force"

echo.
echo === Done! Zip saved to Desktop: kharta-extension-v0.2.2.zip ===
echo.
pause
