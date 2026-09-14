# geolint demo — render with: vhs media/demo.tape
# Requires: npm link done + demo site at :4173
#   python3 -m http.server 4173 --directory examples/demo-site

Output media/demo.gif

Set Shell "zsh"
Set FontSize 15
Set Width 1600
Set Height 950
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms
Set Padding 20
Set WindowBar Colorful
Set Framerate 30

Type "geolint check localhost:4173 --ignore technical/https"
Sleep 700ms
Enter
Sleep 10s

Type "clear"
Enter
Sleep 500ms

Type "geolint init localhost:4173"
Sleep 700ms
Enter
Sleep 8s
