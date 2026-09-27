# Upload Bank Heist to Data Foundry

[Back to README](../README.md)

Upload **one file: [bank-heist.html](../bank-heist.html)**. It includes the application, CSS and course libraries. Use a dedicated dataset for the public module.

## Upload and open

1. Sign in to [TU/e Data Foundry](https://data.id.tue.nl/) and open your course project, or create a project for your group.
2. Add a dataset of type **Existing Dataset**. Give it a descriptive name, such as `Bank Heist module`.
3. Upload `bank-heist.html`. On GitHub use **Download raw file**, rather than saving the GitHub page.
4. In the dataset's **Configuration**, open **Web Access** and activate it. This creates a public web URL.
5. Set **Web Access Entry Point** to **bank-heist.html**.
6. Open the generated URL. You should see the Bank Heist team-selection dialog. Share this playable link with your group.

These settings follow the [official Existing Dataset guide](https://data-foundry.net/Learning/Datasets/DatasetsOverview/existingdataset.html#configuring-an-existing-dataset). The [course-linked Things reference](https://oocsi.id.tue.nl/things/reference.html) recommends this hosting route. Button placement can vary by version; this guide is based on the documentation, not a completed upload of this repository.

You do not need to rename the file to `index.html`. The repository's `index.html` is only a redirect and is not the standalone module.

## Verify the hosted module

1. Open the web URL on your intended device.
2. Choose **Try offline demo**, confirm setup and start. Check the map and movement controls.
3. Return to live mode and select your team. Team 2 uses `OOCSI-things/team-2`.
4. Configure the camera for that exact channel using the [DIY recipe](DIY.md), then select its discovered sender.
5. Walk the field and test a full round, LED guidance and reset with the real kit.

Open the shared URL in a browser that is not signed in to Data Foundry to confirm you shared the playable link rather than the dataset management page.

## Hosting versus live data

Data Foundry serves HTML; Bank Heist exchanges camera messages directly with OOCSI. No Data Foundry API token needs inserting into the app. The dataset's **Forward data to OOCSI** option is unnecessary: it forwards file-upload metadata rather than gameplay.

Web Access exposes the hosted dataset through its public link. Keep it limited to the module; do not upload credentials, logs, `.venv`, `.toolchain` or test fixtures. This module does not save rounds or radar samples to Data Foundry. Research logging would be a separate feature.

## Updating

Maintainers run `npm run build` and `npm test`, then upload the regenerated `bank-heist.html`. Check the entry point still selects the intended file. Keep a local copy of the previous working file before replacing it. Reload outside an active round; hard-refresh if an older version appears.

See [troubleshooting](TROUBLESHOOTING.md) for loading and pairing problems.

## Team 2 deployment

[Play Bank Heist](https://data.id.tue.nl/web/djI6N01hckdUYks4bUZJeXE1RlhPY1hUQWxfRFl4bWd4NXpSRklGbmVvVUZ5U3dYTGxwbmVwWUdYQURTTG5iRGl3/) - [manage dataset](https://data.id.tue.nl/datasets/27070). Uploaded and offline-demo checked on 2026-09-27. Project 13764; dataset 27070.
