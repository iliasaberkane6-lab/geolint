# geolint demo — render with: vhs media/demo.tape
# Requires the demo site running: python3 -m http.server 4173 --directory examples/demo-site

Output media/demo.gif

Set Shell "zsh"
Set FontSize 16
Set Width 1500
Set Height 900
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms
Set Padding 20
Set WindowBar Colorful
Set Framerate 30

Type "npx geolint check localhost:4173 --ignore technical/https"
Sleep 600ms
Enter
Sleep 9s

Type "clear"
Enter
Sleep 400ms

Type "npx geolint init localhost:4173"
Sleep 600ms
Enter
Sleep 8s
