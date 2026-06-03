{ pkgs, lib, config, inputs, ... }:

{
  languages.javascript.enable = true;
  languages.javascript.npm.enable = true;
  languages.javascript.npm.install.enable = true;
  dotenv.enable = true;
  enterShell = ''
    echo ""
    echo "Remember to pull force, github does a push force every sunday with the cache"
    echo ""
    echo "   git stash && git pull --rebase && git stash pop"
    echo ""
  '';
}
