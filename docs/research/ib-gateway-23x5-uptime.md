# IB Gateway: running the paper session 23 hours a day, 5 days a week

Researched 2026-11-10. Facts only. The design decision belongs to the planning ticket.

**Question.** A Setup must enter in every session of the CME Trading day (18:00 New York, Sunday–Thursday evening, to 16:00 the next day). So the bot and IB Gateway must run about 23 hours a day, 5 days a week, against the **Paper account** (port 4002). What keeps a Gateway session alive that long without a human? A smoke test on Gateway 1033.1 already found three manual steps after a restart: click the paper-trading disclaimer (error 10141 until clicked), turn Read-Only API off again, and avoid error 162 when the live username is logged in elsewhere. Gateway 1033.1 is desupported on 15 Dec 2026 (1050.1 minimum).

## How the sources were checked

- **IBC** (`IbcAlpha/IBC`) and **`gnzsnz/ib-gateway-docker`** were cloned from GitHub and read directly: `README.md`, `userguide.md`, `resources/config.ini`, the Java source, and `git log`. Tag: **[primary, read]**. IBC's release notes were read from its GitHub releases page **[primary, read]**.
- **IBKR pages could not be opened.** The sandbox could not reach `www.interactivebrokers.com`, `www.ibkrguides.com`, `ibkrcampus.com` or `interactivebrokers.github.io`. Their content was read through search-engine extracts that quote the page. Tag: **[primary, via extract]**. Re-read the page before relying on an exact time or number.
- VPS provider pricing pages could not be opened either. Prices come from third-party summaries. Tag: **[secondary]**.
- GitHub issues and pull requests of other projects, forum posts and vendor blogs are tagged **[secondary]**.
- A claim no source states, reasoned from the ones that do, is tagged **[inference]**. Things nobody answered are listed under **Unknowns**.

## Summary

| # | Question | Short answer | Strength |
|---|---|---|---|
| 1 | Auto-restart vs auto-logoff | Auto-restart restarts Gateway daily and keeps the login token. Auto-logoff shuts it down and needs a full login each day. | primary, via extract |
| 1 | Weekly full login | Required once a week: tokens are invalidated each Sunday at 01:00 ET. One IBKR API page says the weekly cycle starts Monday: **conflict**. | primary, via extract |
| 1 | 2FA on a paper login | IBKR says all accounts must enrol in 2FA. Users report paper usernames log in without it. **Not settled.** | primary, via extract vs secondary |
| 1 | Disclaimer after restart | Shown on every paper login, including the weekly re-login. Whether the daily auto-restart shows it is unconfirmed. | secondary |
| 2 | IBC | Fills login, accepts the paper disclaimer, sets Read-Only API, drives auto-restart and a Sunday cold restart. Does not complete 2FA itself. GPL-3.0. **Retired 1 Sep 2026, repo archived.** Last release 3.24.2 (21 Aug 2026) supports Gateway 10.48 onwards. | primary, read |
| 3 | Read-Only API persistence | Persists in Gateway's saved settings; IBC re-applies it at each start. Through the API, `updateConfig` can change API settings but not Read-Only itself. A 10.50 restart notice can stop the setting being saved. | primary, read / via extract; secondary |
| 4 | Second username for data | Yes: up to two usernames per individual; the paper account can share data from a chosen live username. Subscriptions are per username, so the second one pays again. | primary, via extract |
| 5 | Cloud/VPS | No IBKR rule against it found. IBKR says headless operation (no GUI) is not supported. Daily reset 00:15–01:45 ET; Saturday maintenance. | primary, via extract |
| 6 | Hosting | Docker image `gnzsnz/ib-gateway` bundles Gateway, IBC, Xvfb, x11vnc, socat; actively maintained. A 2 vCPU / 4 GB VPS is about US$20–24/month. | primary, read; secondary |

---

## 1. Daily restart, weekly login, 2FA, disclaimer

### Auto-restart vs auto-logoff

- **IBKR's rule.** "It is compulsory for TWS users to auto logoff/auto restart TWS daily and manually login TWS weekly." Both are set under Global Configuration → Lock and Exit. For API users IBKR recommends "Never lock Trader Workstation" and "Auto restart". IB Gateway is not locked for inactivity. Source: TWS API docs, "Daily & Weekly Reauthentication", https://www.interactivebrokers.com/docs/tws-api/doc/tws-settings/daily-weekly-reauthentication **[primary, via extract]**.
- **Auto-restart** closes and restarts the application at the chosen time *without* re-authentication. The procedure "will require manual authentication once a week, the first time you log into the platform after the security tokens have been invalidated." That "occurs each Sunday at 1:00 am ET." Source: IBKR Guides, "Auto Restart Considerations", https://www.ibkrguides.com/traderworkstation/auto-restart-considerations.htm **[primary, via extract]**.
- **Things that break the daily restart** (same page): the machine is asleep, hibernating or without power at restart time; an OS update forces a reboot; or IBKR revokes the token "in rare cases, for example for security reasons", which then needs manual authentication **[primary, via extract]**.
- **Auto-logoff** shuts the application down. The next start is a full login (with 2FA where required). IBC's guide: "the only alternative to auto-restart is auto-logoff". Source: `IBC/userguide.md` line ~171 **[primary, read]**; IBKR's page names both options **[primary, via extract]**.
- **Conflict on the weekly day.** The TWS API page says "the weekly authentication cycle starts on every Monday" **[primary, via extract]**. The Guides page says Sunday 01:00 ET **[primary, via extract]**. IBC builds its Sunday cold restart on "after 01:00 US/Eastern" on Sundays (`resources/config.ini`, "Auto-Restart limitations and Cold Restart") **[primary, read]**. Sunday 01:00 ET and "the cycle starts Monday" may describe the same cut-over **[inference]**; either way the first Gateway start of the CME week (Sunday 18:00 ET) falls after it.
- **What this means for 23/5 [inference].** With auto-restart set daily, one full login per week is needed, after Sunday 01:00 ET and before the Sunday 18:00 ET session. Every other day the restart keeps the session. The daily restart time is a choice: it should fall outside the CME session, for example in the 16:00–18:00 ET gap.

### Does a paper login need 2FA?

- **IBKR's position:** all IBKR accounts must enrol in two-factor authentication, and the Secure Login System cannot be disabled for Client Portal or the trading platforms. Sources: https://www.interactivebrokers.com/en/general/secure-login.php and https://ibkrguides.com/securelogin/sls/twofactorauth.htm **[primary, via extract]**. The extracts do not single out paper usernames.
- **User reports differ.** In `gnzsnz/ib-gateway-docker` discussion #126 the image's maintainer writes (Apr 2025) "I'm using my paper account with no M2F"; one user says (Jan 2025) "2FA is mandatory for all IB accounts, including paper trading accounts"; another says (Mar 2026) "IB no longer requires 2FA for paper accounts at all, as per their support". https://github.com/gnzsnz/ib-gateway-docker/discussions/126 **[secondary]**.
- **Check this on the user's own paper username** (the 1033.1 smoke test would show it). **[unknown]**
- IBC "cannot automatically complete your login if Interactive Brokers have given you a card or device that you must use during login"; with IBKR Mobile it can retry the push alert (`ReloginAfterSecondFactorAuthenticationTimeout`). Source: `IBC/README.md`, `resources/config.ini` lines 115–180 **[primary, read]**.

### Does the restart re-show the paper disclaimer?

- IBC's config: "Logging in to a paper-trading account results in TWS displaying a dialog asking the user to confirm that they are aware that this is not a brokerage account. Until this dialog has been accepted, TWS will not allow API connections to succeed." `resources/config.ini` (`AcceptNonBrokerageAccountWarning`) **[primary, read]**. This matches error 10141 in our smoke test.
- **Every paper login shows it.** The `heshiming/ibga` project fixed its handler (PR #41, merged 29 Sep 2026, Gateway 10.45.1j) because paper setups "hit this once a week, on the first auto-restart after the Sunday reset" (the weekly re-login). https://github.com/heshiming/ibga/pull/41 **[secondary]**.
- A cold start can show it late, after a controller's post-login check has passed; the API port is already open while clients get 10141. https://github.com/code-hustler-ft3d/ibg-controller/issues/81 (Nov 2026) **[secondary]**.
- Whether a token-keeping daily auto-restart shows it: not stated by any source found. **[unknown]** IBC's handler fires whenever the dialog opens, so with IBC it does not matter (section 2).
- **Health check [inference from the secondary reports].** An open port does not mean the API works. A readiness check should be a real API handshake that returns managed accounts without error 10141.

## 2. IBC

- **Status: retired.** "This project has been retired, as of 1 September 2026 … there will be no further development of IBC, other than completing work in progress at that date and fixing any significant newly reported bugs. Nor will IBC be actively supported on this repository." The repository is archived (read-only); releases can still be downloaded and the project forked. "It is intended to produce a final release that clears all outstanding issues." Source: `IBC/README.md`, commit `fc6d917` (2026-09-01); https://github.com/IbcAlpha/IBC **[primary, read]**. Reasons: GitHub discussion #347 (not read). Questions go to https://groups.io/g/ibcalpha.
- **Licence:** GNU GPL v3 (`LICENSE.txt`) **[primary, read]**.
- **Latest release:** 3.24.2, published 21 Aug 2026. "The main fix here is to support the latest versions of TWS and Gateway (ie 10.48 onwards)." "IBKR have re-targeted TWS and Gateway from Java 17 to Java 25 for the latest releases." Source: https://github.com/IbcAlpha/IBC/releases and commit `80cb002` "Provide support for TWS/Gateway v1048 and later" (2026-08-18) **[primary, read]**. So **1050.x is covered**. The start scripts' default `TWS_MAJOR_VRSN` is 1045; it must be set to the installed version **[primary, read]**. The Docker image below runs IBC 3.24.2 with Gateway 10.50.1f and 10.51.1e **[primary, read]**.
- **What it automates** (`README.md`, `resources/config.ini`) **[primary, read]**:

| Task | IBC | Setting |
|---|---|---|
| Fill username/password and click Login | Yes | `IbLoginId`, `IbPassword`, `TradingMode=paper` |
| 2FA | Does not complete it. Waits; can re-login if the IBKR Mobile alert times out. | `SecondFactorDevice`, `ReloginAfterSecondFactorAuthenticationTimeout`, `SecondFactorAuthenticationTimeout` |
| Paper disclaimer | Clicks "I understand and accept" whenever the dialog opens (window handler, not a one-off check) | `AcceptNonBrokerageAccountWarning=yes` (sample file has `no`; comment says default `yes`) |
| Read-Only API | Sets it at each start; blank leaves Gateway's setting alone | `ReadOnlyApi=no` |
| Daily auto-restart | Sets Gateway's Lock-and-Exit restart time; the restart needs no re-authentication | `AutoRestartTime=hh:mm AM/PM` (or `AutoLogoffTime`) |
| Weekly full login | "Cold restart": on Sundays at a set local time after 01:00 ET it closes Gateway and starts a fresh full login. "For a live account, the time chosen should be convenient for you to handle 2FA alerts." | `ColdRestartTime=hh:mm` |
| Other session logging in | Can keep or give up the session | `ExistingSessionDetectedAction` |
| Shut down at a set time/day | Yes | `ClosedownAt` |
| Remote commands | STOP, RESTART, ENABLEAPI, RECONNECTDATA, etc. over a command port | `CommandServerPort` |

- The disclaimer handler: `src/ibcalpha/ibc/NonBrokerageAccountDialogHandler.java` recognises any dialog containing "This is not a brokerage account" on `WINDOW_OPENED` and clicks "I understand and accept"; it is registered for the whole session in `IbcTws.java` line 331 **[primary, read]**.
- **Successor projects (none endorsed by IBC).** `code-hustler-ft3d/ibg-controller` (MIT) calls itself the successor for IBC users, keeps the gnzsnz image's environment variables and IBC's command names, and adds TOTP-based 2FA for the weekly login. https://github.com/code-hustler-ft3d/ibg-controller **[secondary]**. `heshiming/ibga` is another unattended Gateway image **[secondary]**.

## 3. Read-Only API across restarts

- **Where it lives.** Global Configuration → API → Settings → "Read-Only API". It is on by default and blocks API orders; IBKR's setup guide says to untick it. Sources: https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/ and https://interactivebrokers.github.io/tws-api/initial_setup.html **[primary, via extract]**.
- **IBC on persistence.** "If not set, the existing TWS/Gateway configuration is unchanged. NB: this setting is really only supplied for the benefit of new TWS or Gateway instances that are being automatically installed … (eg Docker containers). Where a user is involved, they should use the Global Configuration to set the relevant checkbox (this only needs to be done once)." `resources/config.ini` **[primary, read]**. So IBC's author expects the checkbox to persist in Gateway's saved settings.
- **Through the API itself.** From TWS API 10.44, `reqConfigProtoBuf` / `updateConfigProtoBuf` can read and change Orders, Precautions and API settings (`ApiSettingsConfig` has a `readOnlyApi` field), but "Read-Only access to the system must be first disabled manually through the GUI." Sources: https://www.interactivebrokers.com/docs/tws-api/doc/setting-management/request-configuration-update and https://www.interactivebrokers.com/docs/tws-api/protobuf/api-settings-config **[primary, via extract]**. So the bot cannot turn Read-Only off for itself. Whether `ib_async` 2.1.0 exposes these protobuf calls was not checked. **[unknown]**
- **Why it may not persist on 10.50 [secondary].** On Gateway 10.50.1f, choosing Auto restart in the settings dialog opens an "IBKR Gateway" notice about daily automatic restarts; Gateway saves the dialog only after that notice is answered. If nothing answers it, the Read-Only change is never saved. https://github.com/code-hustler-ft3d/ibg-controller/issues/69 and PR #70 (Oct 2026). IBC 3.24.2 restored its `AutoRestartConfirmationDialog` handler on 2026-08-11 (`git log`) **[primary, read]**, which looks like the same dialog **[inference]**.
- **Settings files.** Gateway keeps its settings in the Jts directory (`jts.ini` plus a per-user folder with `ibg.xml`). A 2019 report found `ibg.xml` holding the right value while the setting still reverted when started through IBC. https://groups.io/g/insync/topic/31344768 **[secondary]**. No IBKR page found documents a file key for Read-Only API. **[unknown]**
- **Why it was lost after our 1033.1 restart: not determined.** One likely cause is that the setting was never saved (dialog not closed with OK/Apply, or a Docker/fresh settings directory) **[inference]**. Whether ≥1050 keeps it across a plain restart: no source found either way. **[unknown]**

## 4. Real-time data for the paper session while the user trades live

- **Paper shares a live user's data.** "Market data may also be shared between a live and paper username so that both can retrieve data using the same market data subscription. Each Live user can share data with one (1) Paper account, with one Paper account allowed per live account." In paper settings the account holder can select *which* username on the live account to share from. Off by default. Up to 24 hours to take effect. Sources: https://www.interactivebrokers.com/docs/general/market-data-subscriptions/market-data-users/market-data-sharing and https://www.interactivebrokers.com/campus/trading-lessons/request-paper-trading-account/ **[primary, via extract]**.
- **One session per shared username.** "If the market data is shared, the user cannot access the data for both the live account and the paper trading account at the same time." A paper session gets no data while the shared live user is logged in to Client Portal. Source: IBKR Campus lesson above; https://www.interactivebrokers.com/lib/cstools/faq/content/1136176599 **[primary, via extract]**. This is the error 162 we saw.
- **A second username is allowed.** An individual account holder can have up to two usernames, added in Portal → Settings → Users & Access Rights and marked as a secondary username; IBKR's example is logging in from two machines. Sources: https://www.ibkrguides.com/orgportal/uar/users.htm and https://www.ibkrguides.com/brokerportal/uar/addingusernamestoauser.htm **[primary, via extract]**.
- **It pays again.** "Subscriptions are charged on a per username basis and subscriptions cannot be shared between usernames even if they are on the same account." Source: https://www.interactivebrokers.com/en/pricing/market-data-pricing.php and https://www.interactivebrokers.com/docs/general/market-data-subscriptions/market-data-users/introduction **[primary, via extract]**.
- **The resulting setup [inference].** Create a second live username, subscribe *it* to the CME data the bot needs, and share *its* data with the paper account. The user then uses the main username in TWS/mobile/web, and the paper Gateway's data does not collide with it. Cost: one more set of CME subscriptions (and any per-user fees). Whether the second username counts as non-professional on its own was not found. **[unknown]**
- The paper username itself has no subscriptions of its own; there is no "paper-only" data subscription found. **[unknown]**

## 5. Cloud/VPS and IBKR's down times

- **No rule against a VPS found.** No IBKR page found forbids running TWS or Gateway on a cloud server. **[unknown]** What IBKR does say: "headless" operation without a GUI is not supported, because both apps are built for the user to enter credentials in the GUI. Sources: https://interactivebrokers.github.io/tws-api/initial_setup.html and https://www.interactivebrokers.com/docs/third-party-integrations/general-third-party-frequently-asked-questions **[primary, via extract]**. Running Gateway under a virtual display (Xvfb) is the common workaround **[secondary]**; it still has a GUI, just not a physical screen **[inference]**.
- A forum user says IBKR routes a login to a regional server by IP; another speculates a US VPS is not allowed for an EU account (unverified). https://www.elitetrader.com/et/threads/running-ibkr-scripts-via-tws-ib-gateway-in-the-cloud-us-server-eu-user.385262/ **[secondary]**.
- **Daily reset.** North America: 00:15–01:45 ET, Sunday to Friday. IBKR: the platform is available 24/7 except reset times; the whole period is not necessarily down, but logins and order management may be interrupted. Source: https://www.interactivebrokers.com/en/software/systemStatus.php **[primary, via extract]**. This falls inside the CME session **[inference]**: the bot must ride out disconnects there.
- **Weekend maintenance.** Recent snapshot: Saturday 00:00–02:00 ET. A 2025 snapshot showed Friday 23:00 ET to Saturday 03:00 ET with all services down. **Conflict**; read the live page. Both lie outside the CME week (closed Friday 17:00 ET to Sunday 18:00 ET) **[inference]**.
- **Weekly token invalidation:** Sunday 01:00 ET (section 1).
- Web API (Client Portal) maintenance times differ and do not apply to Gateway/TWS. https://www.interactivebrokers.com/docs/web-api/trading/usage-and-availability/scheduled-server-maintenance **[primary, via extract]**.

## 6. Hosting options (short)

- **`gnzsnz/ib-gateway-docker`** (MIT). Bundles IB Gateway (stable or latest), IBC, Xvfb, x11vnc (optional, password-gated), socat (exposes the API port, e.g. `127.0.0.1:4002:4004`), optional SSH tunnel, Docker secrets, `TRADING_MODE=paper|live|both`. Environment variables map to IBC settings: `READ_ONLY_API`, `AUTO_RESTART_TIME`, `TWS_COLD_RESTART`, `RELOGIN_AFTER_TWOFA_TIMEOUT`, `TIME_ZONE`, `TWS_SETTINGS_PATH` (volume to keep settings). Current images (README): `stable` = Gateway 10.50.1f + IBC 3.24.2; `latest` = 10.51.1e + IBC 3.24.2. Last commit 2026-10-27; weekly `latest` bumps through October 2026. Source: https://github.com/gnzsnz/ib-gateway-docker (README, `latest/Dockerfile`, `git log`) **[primary, read]**. It depends on IBC, now retired (section 2).
- **Location.** VPS hosts market "near IBKR" servers in New York/New Jersey or Chicago **[secondary]**. For a bot entering on 1-minute-or-slower Setups, latency is not the constraint **[inference]**.
- **Price of a 2 vCPU / 4 GB Linux VPS** (third-party summaries; official pages not reachable) **[secondary]**:

| Provider | Plan | ≈ US$/month | Official pricing page |
|---|---|---|---|
| DigitalOcean | Basic droplet 2 vCPU / 4 GB | 24 | https://www.digitalocean.com/pricing/droplets |
| Vultr | Cloud Compute (regular) 2 vCPU / 4 GB | 20 | https://www.vultr.com/pricing/ |
| AWS Lightsail | Linux 4 GB / 2 vCPU bundle | 24 | https://aws.amazon.com/lightsail/pricing/ |

  Sources for the figures: https://www.comparevps.com/hosting/digitalocean, https://checkthat.ai/brands/vultr/pricing, https://cloudburn.io/blog/amazon-lightsail-pricing **[secondary]**.

## Unknowns

1. Whether the user's paper username needs 2FA at login. Check on the next manual login.
2. Whether the weekly re-authentication is Sunday 01:00 ET or "Monday" (IBKR pages conflict), and exactly which restart first needs it.
3. Whether a token-keeping daily auto-restart re-shows the paper disclaimer (with IBC it is clicked either way).
4. Why Read-Only API was lost after the 1033.1 restart, and whether Gateway ≥1050 keeps it across a plain restart.
5. Where Gateway stores Read-Only API on disk; no IBKR page documents it.
6. Whether `ib_async` 2.1.0 exposes `reqConfig` / `updateConfig`.
7. Whether a second username is billed at non-professional rates and any per-user fee beyond the subscriptions.
8. IBKR's terms on running Gateway on a cloud VPS: nothing found either way.
9. The current weekend maintenance window (two snapshots conflict).
10. Whether IBC's final release will add anything, and how long it keeps working with new Gateway versions now that it is retired.

All IBKR claims came through search extracts because the IBKR sites were blocked. A person with normal web access should re-read the cited pages, starting with Auto Restart Considerations, Daily & Weekly Reauthentication, Market Data Sharing, the market-data pricing page and the system status page.
