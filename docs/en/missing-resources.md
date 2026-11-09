# Missing resources

*[Version française](../fr/missing-resources.md)*

What the application does when an open Project cites 3D models, Panel images or fonts it cannot find,
and how to see it without breaking a real Project.

## Why it happens

Models and images are not stored next to the Project file, but in the `Modeles` and `Images` folders
of the **Projects folder** set in Settings. That folder differs depending on how the app is launched:
- with `npm start`, it is `Projets` at the root of the repository;
- once installed, it is `Documents\Storyboarder BD\Projets`, and the installed version has its own
  settings.

An added font is a family name, not a file: it is missing if it is neither built in nor in `Polices`
(renames followed, see [polices.md](polices.md)); `policeDisponible` decides.

## What the application does

After a Project opens, and **after** renamed models are repointed, `src/missing-resources.js` compares
what the Project cites (every Page of every Volume, and the Scenes) with the **listings** of the
folders. Cache state is not consulted: a file that is present but unreadable is not a folder problem.

If something is missing, the "Missing resources" modal says:
- how many models, images and fonts are missing, and that nothing is removed from the Project;
- where the application looked (full paths);
- which files, eight per category, then "and N more";
- how to fix it: choose the right folder in Settings (a button opens it), copy the files, or add the
  font back from "My fonts";
- a hint if the Project is saved somewhere other than the Projects folder.

Changing folder ("Choose..." or "Default folder") forgets the files declared missing, restarts
preloading and checks again: the modal updates or disappears, without restarting.

## Seeing the modal without breaking a Project

In development only, the `STORYBOARD_SIMULER_RESSOURCES` variable opens the modal at startup with fake
data (three models and eleven images missing, a Project stored elsewhere); the search paths are the
real ones.

```
[Console]::OutputEncoding=[Text.Encoding]::UTF8; cd C:\WebProjects\Storyboarder; $env:STORYBOARD_SIMULER_RESSOURCES='1'; npm start
```

The variable stays set in that terminal, which a yellow banner signals. To return to normal, close the
terminal, or:

```
[Console]::OutputEncoding=[Text.Encoding]::UTF8; Remove-Item Env:STORYBOARD_SIMULER_RESSOURCES; cd C:\WebProjects\Storyboarder; npm start
```

Without simulation: set an empty Projects folder in Settings, reopen the Project, then go back with
"Default folder".
