# Upload Bank Heist to Data Foundry

[Back to README](../README.md)

Upload **one file: [bank-heist.html](../bank-heist.html)**. It includes the application, CSS and course libraries. Use a dedicated dataset for the public module.

The GitHub release updates progression to the final report order. Publishing to GitHub does not update the existing hosted page: replace its HTML with this release to apply that change.

## Upload and open

1. Sign in to [TU/e Data Foundry](https://data.id.tue.nl/) and open your course project, or create a project for your group.
2. Add a dataset of type **Existing Dataset**. Give it a descriptive name, such as `Bank Heist module`.
3. Upload `bank-heist.html`. On GitHub use **Download raw file**, rather than saving the GitHub page.
4. In the dataset's **Configuration**, open **Web Access** and activate it. This creates a public web URL.
5. Set **Web Access Entry Point** to **bank-heist.html**.
6. Open the generated URL. You should see the Bank Heist mission briefing. **Connect your crew** opens team selection; **Try the offline heist** starts practice. Share this playable link with your group.

These settings follow the [official Existing Dataset guide](https://data-foundry.net/Learning/Datasets/DatasetsOverview/existingdataset.html#configuring-an-existing-dataset). The [course-linked Things reference](https://oocsi.id.tue.nl/things/reference.html) recommends this hosting route. Button placement can vary by version. The Team 2 deployment below was uploaded and checked through the signed-in Data Foundry UI.

You do not need to rename the file to `index.html`. The repository's `index.html` is only a redirect and is not the standalone module.

## Verify the hosted module

1. Open the web URL on your intended device.
2. Choose **Try the offline heist**, check the play area and arm the heist. Check the map and movement controls; the ten-minute clock starts when the player leaves the safe zone.
3. Return to live mode and select your team. Team 2 uses `OOCSI-things/team-2`.
4. Configure the camera for that exact channel using the [DIY recipe](DIY.md). A sole fresh device is selected automatically; choose a sender if several are present.
5. Walk the field and test the complete heist, all physical modules, shared penalties, safe-zone return, LED guidance and reset with the real kit.

Open the shared URL in a browser that is not signed in to Data Foundry to confirm you shared the playable link rather than the dataset management page.

## Hosting versus live data

Data Foundry serves HTML; Bank Heist exchanges camera messages directly with OOCSI. No Data Foundry API token needs inserting into the app. The dataset's **Forward data to OOCSI** option is unnecessary: it forwards file-upload metadata rather than gameplay.

Web Access exposes the hosted dataset through its public link. Keep it limited to the module; do not upload credentials, logs, `.venv`, `.toolchain` or test fixtures. This module does not save rounds or radar samples to Data Foundry. Research logging would be a separate feature.

## Updating

Maintainers run `npm run build` and `npm test`, then upload the regenerated `bank-heist.html`. Check the entry point still selects the intended file. Keep a local copy of the previous working file before replacing it. Reload outside an active round; hard-refresh if an older version appears.

See [troubleshooting](TROUBLESHOOTING.md) for loading and pairing problems.

## Team 2 deployment

Updated **19 October 2026**, dataset 27070 **record 36**: Laser test-page
alignment mode shows detected/missing/stale receiver states and raw readings,
with local counters paused during mirror alignment. The USB VBUS-powered
emitter stays on; no power-switching command or second controller is sent.
All 106 source tests pass. The laser C3 firmware compiled with continuous
diagnostic baselines. Browser checks used simulated inputs; the anonymous
hosted page exposes the new controls. HTML SHA-256:
`B09F48CD2BC72AA987A910A9D243D4651E1345DC56FCAFF023AA82D31CC802DF`.
The hosted file matches the local deliverable exactly. Record 35 was backed
up as ignored `test-output/data-foundry-before-laser-alignment.html` before
replacement. Its previous hash was verified. The public link is unchanged.

[Play Bank Heist](https://data.id.tue.nl/web/djI6N01hckdUYks4bUZJeXE1RlhPY1hUQWxfRFl4bWd4NXpSRklGbmVvVUZ5U3dYTGxwbmVwWUdYQURTTG5iRGl3/) - [manage dataset](https://datafoundry.id.tue.nl/datasets/27070). Project 13764; dataset 27070. Originally deployed on 2026-09-27 and updated on 2026-10-18 in the existing dataset, retaining the public link and `bank-heist.html` entry point. The current replacement file record is **35**.

Record 35 maps the friend's calibrated ten-position Skidule firmware onto four bars, advertises all module input fields, and adds direct ESP32-S3 vault telemetry, presenter controls and a targeted Vault door test tab. All 98 JavaScript checks pass; browser fixtures verified legacy packets, all four locks, explicit vault acknowledgements and active-heist rejection without contacting real motors. The S3 sketch compiled separately, with 19 compile-time policy checks. Current HTML SHA-256: `D9F2EE498EF182ED3E4C81C3777A3B9C7A0D9B441AC7171E24B7E9D14F9913FC`. Record 34 was backed up as local ignored `test-output/data-foundry-before-direct-vault.html` and its hash matched the previous deployment. The anonymous public page loads the new workshop and Vault door tab.

Record 34 added **Test your module** to the home screen. Multiple people could connect independent input benches to Team 2 without publishing game commands or competing with the crew controller. All 88 JavaScript checks passed, the bundled module was checked with simulated inputs and zero application messages sent, and two hosted test tabs connected simultaneously. No physical ESP input was received during that hosted connection check. [Hardware test instructions](TESTING_HARDWARE.md). That HTML's SHA-256 was `FBA6452CC36F3379FEDB71A96DA7ABF980EA14D94293E702836A950A2747DEF4`. Record 33 was backed up locally before replacement.

The earlier 2026-10-18 upload (record 33) introduced the story briefing, shared ten-minute heist clock and penalties, four module terminals, Skidule percentage input, safe-zone escape and dedicated results screen. That HTML's SHA-256 was `69FE4105D5D555DB4B403198BB2BA7FA9FE694849061498D72EF31EE3C09DF06`.

The original public link was checked without a Data Foundry login. Hosted offline practice verified departure starts the clock, a simulated laser cut deducts five seconds and adds one shared anomaly, module passes preserve the clock, `2026` completes the final override after Skidule, returning to safety shows the win screen, and restart restores 10:00, zero anomalies and zero completed modules. Presenter assistance was explicitly shown on the result. No hosted live hardware round was performed. Screenshots are in the local ignored `test-output/data-foundry-published-start.png` and `test-output/data-foundry-published-win.png`; the previous uploaded HTML was backed up locally before replacement.
