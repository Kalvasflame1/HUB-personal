#!/bin/zsh
# Detiene y desinstala el agente de launchd del worker. No borra el registro ni ningún dato.
LABEL="com.personalhub.worker"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null && echo "Worker detenido." || echo "El worker no estaba cargado."
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Agente eliminado."
