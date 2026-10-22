# Decision models (Jev, Laya, Clef) for Silver Bullet judgment calls

Research for GitHub issue #20. Question: could a "decision model" make the bot's judgment calls inside the Silver Bullet Setup? A decision model takes a state and a schema of allowed answers and returns probabilities instead of text. Three are covered: **Jev** (TypeSafe AI), **Laya** (Convai Innovations) and **Clef / Clef-flash** (Cloudflare). For each one this note covers versioning, where it runs, repeatability, training data and lookahead risk, input shape, cost and speed, and published benchmarks. It feeds a later grilling ticket, which will make the decision.

Vocabulary follows `GLOSSARY.md`. A **Setup** is the written rules, a **Signal** is one time the rules are met, and a **Window** is the 10:00–11:00 New York hour.

## Read this first: how the sources were reached

- **The vendors' own sites could not be opened.** From this session the proxy refused `typesafe.ai`, `docs.typesafe.ai`, `laya-ai.com` and `developers.cloudflare.com` (CONNECT 403). The suggested secondary hosts were refused too: `huggingface.co`, `openrouter.ai`, `flaviocopes.com`, `datacamp.com`, `digitalocean.com`, `sourceforge.net`, `letsdatascience.com`, `techenclave.com`, `vercel.com`, `infoq.com` and every other news site tried.
- **What could be read in full:**
  - `pypi.org`, including the vendor-written package READMEs and the wheels themselves. The `typesafe-sdk` 0.7.5 wheel contains a request/response schema generated from `https://api.typesafe.ai/openapi.json` (stated in the file header). The `laya` 0.4.13 wheel and its README come from the developer, Convai Innovations.
  - Nothing else. Everything else here comes from **search-engine summaries** of pages that could not be opened (the WebSearch tool's result text). Those are marked **[secondary, search summary]** and are weaker than a page that was read.
- **Tags:**
  - **[primary]** means text written by the vendor and read directly: a PyPI README, or code in the vendor's published package.
  - **[secondary]** means third-party text, or a vendor page seen only through a search summary.
  - Where a vendor's README makes claims about a *competitor*, the claim is tagged [secondary] for that competitor.
- **The leads were partly wrong.**
  - **Laya's Hugging Face repository.** The lead pointed to `huggingface.co/ai-ml-space/laya`. The vendor's PyPI metadata gives the homepage as `huggingface.co/convaiinnovations/laya` and the code repository as `github.com/NandhaKishorM/laya` ([PyPI laya, primary](https://pypi.org/project/laya/)). The `ai-ml-space` repo could not be checked.
  - **Laya's website.** Nothing read links `laya-ai.com` to Convai Innovations, so whether that site is the same product is **unknown**.
  - **Unrelated `clef` package.** The PyPI package `clef` (0.0.8, 2015) is a wrapper for an unrelated login API, not Cloudflare's model ([PyPI clef](https://pypi.org/project/clef/)).

## Summary

| | **Jev** (TypeSafe AI) | **Laya** (Convai Innovations) | **Clef / Clef-flash** (Cloudflare) |
|---|---|---|---|
| Weights | Closed, hosted API only [secondary] | Open, Apache-2.0 [primary] | Open, Apache-2.0 [secondary] |
| Size | Unknown (not disclosed) [secondary] | 421M (ModernBERT-large) / 322M (mmBERT-base) [primary] | 27B / 9B, frozen Qwen backbone plus a "joint schema head" [secondary] |
| Hardware to self-host | n/a | Tesla T4 GPU benchmarked; CPU and Apple MPS work [primary] | ~85 GB VRAM (Clef), ~41 GB (Clef-flash) at 64k context [secondary] |
| Version pinning | `model` field; `jev-latest` alias moves, versioned IDs such as 1.13.0 / 1.14.0 pin [primary + secondary] | Hugging Face commit SHA via `revision=` or `LAYA_REVISION`; reviewed SHAs ship in the package [primary] | Self-host: pin the weights. Hosted `@cf/cloudflare/clef`: versioning scheme **unknown** |
| Sampling knobs (temperature, seed) | None in the request schema [primary] | None at inference; calibration temperatures are fixed in the checkpoint [primary] | Unknown; described as one non-autoregressive pass [secondary] |
| Context | 32k (1.13); 64k and an opt-in ~256k reported for 1.14 (sources conflict) [secondary] | 512 tokens (English), 1,024 up to 8,192 (multilingual) [primary] | Clef 64k hosted; Clef-flash hosted cut to 24,576 on 9 Oct 2026; weights said to be trained for 256k [secondary] |
| Image input | Yes: an `assets` map in the API [primary]; experimental, opt-in header from 1.14 [secondary] | No image input found in the README | Clef: text, JSON, images, video; Clef-omni adds audio [secondary] |
| Hosted price (input; output free) | $0.042 / 1M tokens [secondary; "output tokens free" is primary] | $0 self-hosted; Vercel AI Gateway free to 31 Oct 2026 [secondary] | Clef $0.24 / 1M; Clef-flash $0.09, then $0.038 / 1M; Clef-omni $0.15 / 1M [secondary] |
| Training data disclosed | No; reported as "entirely synthetic" [secondary] | Partly: names some public sets in the training mix [primary] | No; Cloudflare confirmed the datasets are not public [secondary] |
| Python client | `typesafe-sdk` (official) [primary] | `laya` (local library and HTTP server) [primary] | None found on PyPI; Workers AI REST, or a Jev-compatible client [secondary] |

## 1. Jev (TypeSafe AI)

### What it is
- Jev is TypeSafe's "System One" model. It "generates no text. It answers typed questions about a state (yes/no probabilities, choices, scores) in one parallel call, with calibrated probabilities." That quote is from the README of the third-party `jev` decorator package, which has no named author ([PyPI jev, secondary](https://pypi.org/project/jev/)).
- TypeSafe came out of stealth on 15 September 2026. Jev is a closed, managed API with no released weights ([WebSearch summary of lilting.ch, rits.shanghai.nyu.edu, infoq.com, secondary](https://lilting.ch/en/articles/typesafe-ai-jev-system-one-model)).
- There are three question types: `noul` (probability of yes), `choice` (one of named options, with a probability for each) and `score` (ordered levels, returning the expected level plus a probability for each level). A fourth type, `box` (bounding box on an image), also exists ([typesafe-sdk 0.7.5 `_schemas/models.py`, primary](https://pypi.org/project/typesafe-sdk/)).

### 1.1 Versioning
- Every request carries a `model` string: "Name or alias of the model to use. Available names are returned by GET /v1/models." The SDK default is `jev-latest`, and the code also uses `jev-preview` ([typesafe-sdk `constants.py`, `_core/question_types.py`, primary](https://pypi.org/project/typesafe-sdk/)).
- The response's `model` field is "Name of the model that answered the questions. **May differ from the alias supplied in the request.**" Each entry in `GET /v1/models` has a `release_date` ([typesafe-sdk `_schemas/models.py`, primary](https://pypi.org/project/typesafe-sdk/)). Logging that response field shows which concrete version answered each call.
- **An alias can change underneath you.** `jev-latest` was due to move from Jev 1.13.0 to 1.14.0 about a week after 1.14 was announced (14 Oct 2026). Using a versioned ID avoids that. TypeSafe said it would give 60 days' warning before deprecating 1.13.0 and 30 days for 1.14.0, with "a fuller deprecation policy" still to come ([WebSearch summary of remio.ai, tilnote.io, aimlapi.com, secondary](https://www.remio.ai/post/jev-1-14-0-release-expands-what-jev-can-see-but-typesafe-wont-call-it-production)). `jev-preview` is also a moving alias ([WebSearch summary of itechguides.com, secondary](https://www.itechguides.com/how-to-use-jev-1-14-image-inputs-in-typesafe-ai-apps/)).
- **Conflict:** aimlapi.com says the alias already pointed to 1.14. Other sources describe the move as still to come.
- **Unknown:** whether a *versioned* ID such as `jev-1.13.0` can still change behind the scenes (a weight refresh or a serving-stack change). No primary source says either way.

### 1.2 Where it runs
- **Hosted only.** The base URL is `https://api.typesafe.ai` ([typesafe-sdk `constants.py`, primary](https://pypi.org/project/typesafe-sdk/)). No weights are released ([secondary, as above](https://lilting.ch/en/articles/typesafe-ai-jev-system-one-model)).
- Jev is also offered through other gateways: Vercel AI Gateway, OpenRouter (`typesafe/jev-1.13`, `typesafe/jev-1.14`), Requesty and AI/ML API ([WebSearch summaries, secondary](https://openrouter.ai/compare/typesafe/jev-1.13)).
- Laya's self-hosted server speaks the same `POST /v1/systemone` wire protocol as Jev, so a Jev client can be pointed at a local Laya server instead ([laya README, primary for Laya](https://pypi.org/project/laya/)).

### 1.3 Repeatability
- **The request has no sampling parameters.** `SystemOneRequest` has only `model`, `state`, `questions` and `assets`: no temperature, seed or top-p ([typesafe-sdk `_schemas/models.py`, primary](https://pypi.org/project/typesafe-sdk/)). The SDK's `extra_body` lets a caller add other fields, but none is documented.
- Secondary write-ups describe "a single forward pass over the input to produce fixed probability distributions". One LinkedIn post mentions "parallel sampling" as part of the architecture ([WebSearch summary, secondary](https://lilting.ch/en/articles/typesafe-ai-jev-system-one-model)).
- **Unknown:** whether two identical requests return identical probabilities. No source tested it or states it. Even with no sampling, a hosted model can drift through batching and floating-point effects, or through a silent serving change.

### 1.4 Training data and lookahead
- TypeSafe has not disclosed the training data or a knowledge cutoff. The CEO is reported as saying Jev "was trained entirely on synthetic data", with an academic paper planned ([WebSearch summary of deeplearning.ai The Batch, levelup.gitconnected.com, letsdatascience.com, secondary](https://www.deeplearning.ai/the-batch/models-built-to-do-one-thing-well)).
- **Unknown:** whatever generated the synthetic data was presumably a large language model, and what that model saw is not known. Whether Jev could have absorbed 2019–2026 NQ/MNQ price history is therefore unknown.

### 1.5 Input
- **API:** `POST /v1/systemone` with `{model, state, questions, assets?}`. `state` may be a string, an object or a list. Answers come back keyed by question name, with `usage {input_tokens, output_tokens}`. `choice` answers carry `choice`, `confidence` and a `probabilities` map, and `score` answers carry `score`, `confidence`, `legend` and `probabilities` ([typesafe-sdk `_schemas/models.py`, primary](https://pypi.org/project/typesafe-sdk/)).
- **Images:** an `assets` map of base64 PNG/JPG images, referenced by placeholder from the state or the questions. The schema says "Image assets require a vision-language model" ([typesafe-sdk, primary](https://pypi.org/project/typesafe-sdk/)). Image input is experimental, gated by an opt-in header (`TypeSafe-Danger-Zone-Images: true` on raw HTTP), and TypeSafe "won't call it production" ([WebSearch summary of alphasignal.ai, itechguides.com, remio.ai, secondary](https://alphasignal.ai/news/typesafe-ai-s-jev-1-14-brings-vision-and-256k-context-to-typed-decisions)). The SDK 0.7.5 code does not contain that header name.
- **Context:** 32,000 tokens on 1.13 per OpenRouter. 1.14 is listed at 64K by some sources, with an experimental opt-in mode of about 262K tokens at the same per-token price but "slower and less accurate" ([WebSearch summary of openrouter.ai, hermes-ai.net, positioniseverything.net, secondary](https://openrouter.ai/compare/typesafe/jev-1.14)). **Conflict:** 32K versus 64K for the base window.
- **Option limit:** up to 255 options per question, according to Laya's README ([laya README, secondary for Jev](https://pypi.org/project/laya/)).
- **Python:**
  - `typesafe-sdk` is the official client: sync and async, retries with tenacity, and a `pil` extra for images. It needs `TYPESAFE_API_KEY` ([PyPI typesafe-sdk, primary](https://pypi.org/project/typesafe-sdk/)). Version 0.7.5 was released on 14 Oct 2026, and seven releases came out between 18 Sep and 14 Oct.
  - `typesafe-ai` on PyPI is a defensive redirect shim registered by a third party ([PyPI typesafe-ai](https://pypi.org/project/typesafe-ai/)).
  - `jev` is a third-party decorator that turns a Pydantic return type into questions ([PyPI jev](https://pypi.org/project/jev/)).

### 1.6 Cost and speed
- **Price:** $0.042 per 1M input tokens ([WebSearch summary of lilting.ch, flaviocopes.com/jev-pricing, secondary](https://flaviocopes.com/jev-pricing/)). Output tokens "are currently free of charge" ([typesafe-sdk `Usage` schema, primary](https://pypi.org/project/typesafe-sdk/)).
- **Latency:**
  - TypeSafe quotes 70–500 ms end to end [secondary].
  - Independent figures: 236–276 ms p50 ([AbdelStark/jev-benchmarks and nibzard/decision-model-benchmark, as cited in the laya README, secondary](https://pypi.org/project/laya/)); 92–214 ms in a playground test; above the claimed range from the US West Coast (BetOnAI) ([WebSearch summary, secondary](https://metricnexus.ai/blog/jev-benchmarks-pricing)).
  - Cloudflare measured Jev at 524.1 ms median ([WebSearch summary, secondary](https://cryptobriefing.com/cloudflare-clef-decision-models-workers-ai/)).
  - **These figures conflict.** They depend on where the test ran from and what was measured.

### 1.7 Benchmarks, calibration, finance
- **Laya's README** quotes "published" Jev 1.13.0 numbers ([laya README, secondary for Jev](https://pypi.org/project/laya/)):
  - typed-decisions accuracy 0.727, Brier 0.148, ECE 0.144;
  - AG News 0.910, DAIR Emotion 0.480, Banking77 0.870;
  - on DAIR Emotion, Jev gave the true label zero probability on 16% of examples.
- **Conflict:** Laya's headline table gives Jev's ECE as 0.246. Its own typed-decisions table gives 0.144.
- **Cloudflare** reports Jev at 79.74 macro-F1 on BANKING77, and at 95.8 BFCL and 88.2 API-Bank ([WebSearch summary, secondary](https://www.testmuai.com/blog/cloudflare-clef/)).
- **wotai.co:** Jev tied Claude Haiku on 150 rows, at 66.0% accuracy and ECE 0.122 against 0.121 ([WebSearch summary, secondary](https://wotai.co/blog/typesafe-jev-vs-claude-haiku-tested)).
- **Financial time series, the closest test to this bot (BetOnAI).** The test used 320 fifteen-minute windows of crypto (AKE) trades on Gate and Kraken, with five typed questions per window, scored against what happened next. "No model beat a coin flip on the 15-minute direction question." The best Brier score was 0.2509 (Gemini, not Jev), against 0.25 for always answering 50% ([WebSearch summary of betonai.net, secondary](https://betonai.net/?p=1928)). Jev's own numbers in that test were not in the summary.

## 2. Laya (Convai Innovations)

### What it is
- Laya is an "open source family of non-autoregressive System 1 decision models" that returns probabilities for `choice`, `score` and `noul` questions "in a single forward pass". It is trained "with reinforcement learning against strictly proper scoring rules (RLCD)". It is developed by Convai Innovations under Apache 2.0 ([laya README, primary](https://pypi.org/project/laya/)).
- Three checkpoints ([laya README, primary](https://pypi.org/project/laya/)):

  | checkpoint | encoder | params | context |
  |---|---|---|---|
  | `convaiinnovations/laya` | ModernBERT-large | 421M | 512 |
  | `convaiinnovations/laya-multilingual` | mmBERT-base | 322M | 1,024 (up to 8,192) |
  | `convaiinnovations/laya-typed-decisions` | ModernBERT-large | 421M | 1,024 |

### 2.1 Versioning
- **The weights can be pinned exactly.** `laya.load(..., revision=...)` or `LAYA_REVISION` pins a Hugging Face commit. `LAYA_REVISION=reviewed` uses reviewed SHAs that ship in the package, for example `convaiinnovations/laya` at `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`. An optional SHA-256 map checks the weight files before they load ([laya 0.4.13 `laya/revisions.py`, primary](https://pypi.org/project/laya/)).
- **Without a pin, `laya.load` follows the Hub's default branch:** "Runtime loaders keep the Hub default revision unless the caller supplies one" [primary]. An unpinned load can therefore change when the vendor pushes new weights.
- **The library moves fast.** There were five releases between 17 and 21 Oct 2026, 0.4.9 to 0.4.13 ([PyPI release history, primary](https://pypi.org/project/laya/#history)). Pin both the `laya` package version and the checkpoint revision.

### 2.2 Where it runs
- **It runs locally.** `pip install laya` needs Python 3.10 or newer and torch 2 or newer. The three checkpoints take about 2.3 GB on disk. It runs on CUDA, CPU, Apple MPS and ONNX Runtime, and an HTTP server is included (`laya[serve]`) ([laya README, primary](https://pypi.org/project/laya/)).
- **Measured speed on a Tesla T4** ([laya README, primary](https://pypi.org/project/laya/)):
  - one question: 39.5 ms (English) and 32.8 ms (multilingual);
  - ten questions: 158.6 ms and 72.3 ms;
  - batched on an RTX 5060 Ti: about 1 ms per decision.
- **CPU and cold-load times:** CPU works. A checkpoint reload took a 7.4 s median on CPU [primary].
- **Hosted:** on Vercel AI Gateway as `convaiinnovations/laya`, "free through October 31" 2026 ([WebSearch summary of vercel.com changelog, secondary](https://vercel.com/changelog/laya-decision-model-now-available-on-ai-gateway-free-through-october-31)). Pricing after that date is unknown.

### 2.3 Repeatability
- **There is no sampling.** The README describes one encoder forward pass and a softmax. The temperatures it mentions are fixed calibration temperatures stored in the checkpoint and clamped to `[0.5, 5.0]`. They are not sampling knobs ([laya README, primary](https://pypi.org/project/laya/)).
- **Some things still change the numbers** ([laya README, primary](https://pypi.org/project/laya/)):
  - **Batch shape.** "Changing batch shapes can introduce floating-point differences on CPU and GPU; check decision thresholds … particularly with mixed precision."
  - **Fast GPU path.** It differs from fp32 by up to 0.046 in probability on a 60-state test set, and from the stock bf16 path by up to 0.076.
  - **Measured upside.** One measured ONNX run showed "0/80 decision changes and max probability drift 0.0".
  - **Built-in check.** The repo ships `verify/numerics_check.py`, described as covering "determinism".
- **What this means:** with the same weights, dtype, device and batching, outputs should repeat. Different hardware or precision can move probabilities by a few hundredths, which matters near a threshold. (This is a reading of the primary text, not a test run here.)

### 2.4 Training data and lookahead
- The README names some public training sets: AG News and BoolQ are "in training mix", while DAIR Emotion, prompt-injections and SST-5 are held out [primary].
- The typed-decisions benchmark compares against a "teacher self-agreement ceiling" of 0.735 [primary]. That suggests its labels came from a teacher model.
- **Conflict:** a developer post, reported via search, says the corpus was "100% human-annotated, with over 25,000 real-world examples" and no synthetic data ([WebSearch summary, secondary](https://huggingface.co/convaiinnovations/laya)).
- **The base encoders:**
  - ModernBERT-large was pre-trained on "2 trillion tokens of English and code data" (web documents, code, scientific articles). Its paper is arXiv 2412.13663, so the data predates late 2024 ([WebSearch summary of the ModernBERT model card, secondary](https://huggingface.co/answerdotai/ModernBERT-large)).
  - No exact data cutoff was found for either encoder.
- **Unknown:** whether any NQ/MNQ price data was in the pre-training text. A 421M encoder classifier is not the kind of model known to recall minute-level price series, but nothing read rules it out.

### 2.5 Input
- **API:**
  - local: `router.predict(state, questions)` or `laya.load(...).predict(...)`;
  - `predict_batch` for many states in one forward pass;
  - `predict_long` for windowed long documents;
  - over HTTP, the Jev-compatible `POST /v1/systemone` and `/v1/systemone/batch` (up to 64 states) ([laya README, primary](https://pypi.org/project/laya/)).
- **Context is the binding limit.** The question and its options share a `head_max_len` budget: 192 tokens on English, 256 on the others. On the English checkpoint the state gets about 463 tokens for a short question [primary].
  - Sixty 1-minute bars as text would very likely overflow 512 tokens. (Inference: no tokenisation was run here.)
  - That pushes toward `laya-multilingual` with `max_len` raised, or toward a compact summary of the bars.
  - **Long inputs lose accuracy.** With `max_len=8192`, 16–18 of 20 requests were correct with up to about 4,000 tokens of preceding text, and results varied more beyond that [primary].
- **Images:** none found. The documented input is text, a JSON document or a conversation. The README never mentions image input. Treat Laya as text only.
- **Python:** the `laya` package itself. Optional extras: `serve`, `onnx`, `fast` (TileLang GPU path), `structured` (pydantic), and LangChain, LlamaIndex and CrewAI integrations [primary].
- **Porting from Jev:** Laya's `confidence` is "1 minus normalised entropy" and differs from Jev's formula, so "a threshold carried over from Jev does not transfer" [primary].

### 2.6 Cost and speed
- **Cost:** $0 per call self-hosted [primary]. The real cost is the hardware. A T4 is the reference GPU, and CPU works, more slowly (no CPU single-call latency figure was found).
- **Speed:** see §2.2.

### 2.7 Benchmarks, calibration, finance
- **The vendor is frank that zero-shot is weak** ([laya README, primary](https://pypi.org/project/laya/)):
  - "The base checkpoints are near chance on typed-decisions zero-shot: 0.362 and 0.352 against a 0.318 random baseline and a 0.461 majority-class baseline."
  - "Laya is a fast base to specialise, not a zero-shot decision engine."
  - The fine-tuned `laya-typed-decisions` scores 0.766 on that benchmark's own split.
- **Calibration** [primary]:
  - "Both checkpoints are over-confident as shipped."
  - Refitting temperatures on held-out data moves ECE from 0.466 to 0.081 (`laya`) and from 0.314 to 0.106 (`laya-multilingual`).
  - "`laya-multilingual` ships with no fitted temperatures at all."
- **Known failure modes** [primary]:
  - `score` is the weakest question type (SST-5 0.372).
  - `noul` on the English checkpoint can follow its `false:`/`true:` labels instead of the state.
  - Negations can flip `choice` answers.
- **Fine-tuning:** a notebook runs on Kaggle's free 2×T4, and an Apple-silicon script is included [primary].
- **Finance:** no use on financial or time-series data was found. A third-party comparison mentions only general local deployment ([WebSearch summary, secondary](https://shop.zimaspace.com/blogs/tech-ai-hub/laya-open-source-decision-model-local-ai)).

## 3. Clef and Clef-flash (Cloudflare)

### What it is
- Released on 1 October 2026: Clef (27B) and Clef-flash (9B). They take "an input state and a schema of typed questions, then return probabilities for each allowed answer" ([WebSearch summary of letsdatascience.com, cryptobriefing.com, infoq.com, secondary](https://letsdatascience.com/news/cloudflare-releases-open-weight-clef-decision-models-c52886d6)).
- Clef-omni, which adds audio, was released on 9 Oct 2026 ([WebSearch summary of techenclave.com, secondary](https://techenclave.com/news/items/cloudflare-adds-clef-omni-and-cuts-clef-flash-pricing-with-a-shorter-hosted-context)).
- **Architecture** ([WebSearch summary of The Register, mer.vin, secondary](https://www.theregister.com/a/5300649)):
  - a frozen Qwen backbone (Clef: "Qwen3.8-27B with vision encoder"; Clef-flash: Qwen3.5-9B) running "a prefill-only pass";
  - rank-256 LoRA adapters;
  - a small "joint schema head" that scores every option of every question in the same pass.
- **Conflict:** one outlet flags "Qwen3.8" as an unusual name and a possible typo ([WebSearch summary of pasqualepillitteri.it, secondary](https://pasqualepillitteri.it/pl/news/19923/cloudflare-clef-wyzwanie-jev)).
- Clef is described as API-compatible with Jev's interface [secondary].

### 3.1 Versioning
- **Self-hosted:** weights on Hugging Face as `Cloudflare/clef` and `Cloudflare/clef-flash` [secondary]. A Hugging Face commit can pin them, in the same way as Laya's. The repo itself could not be opened.
- **Hosted:** Workers AI IDs `@cf/cloudflare/clef` and `@cf/cloudflare/clef-flash` [secondary].
  - The IDs carry no version suffix, and no Clef-specific source on pinning or change notices was found. **Unknown** whether the hosted model can change without notice.
  - **The hosted Clef-flash has already changed after launch.** On 9 Oct 2026 its context was cut from 64k to 24,576 tokens and its price from $0.09 to $0.038 per 1M. "The self-hosted weights remain trained for 256K context" ([WebSearch summary of techenclave.com, latenode.com, fourweekmba.com, secondary](https://techenclave.com/news/items/cloudflare-adds-clef-omni-and-cuts-clef-flash-pricing-with-a-shorter-hosted-context)). The change was announced, so this is not a silent change. But it shows the hosted version is not frozen.

### 3.2 Where it runs
- **Both local and hosted.** Apache-2.0 weights; hosted on Workers AI, and also listed on OpenRouter and Requesty [secondary].
- **VRAM:** Cloudflare's product manager told The Register that Clef-flash runs "on any GPU with at least 41 GB of VRAM", while Clef needs 85 GB, "assuming single concurrency and a 64k context window" ([WebSearch summary of The Register, secondary](https://www.theregister.com/a/5300649)).
- **Other reports:** an aggregator says the model card mentions testing on a single H200, and that the custom head needs the repo's own code. A Tenstorrent port runs on two Blackhole chips [secondary, aggregators].
- **The bot's machine:** neither model fits a typical desktop GPU. Self-hosting means renting an A100-80GB or H100-class card for Clef, or a 48 GB card for Clef-flash. (This follows from the VRAM figures; no rental option was tested.)

### 3.3 Repeatability
- One source describes "one non-autoregressive pass" that returns a probability for every allowed option, with no token decoding to sample from [secondary]. Cloudflare markets the outputs as "deterministic". The summary of that claim reads as being about parse reliability, not run-to-run reproducibility ([WebSearch summary of flaviocopes.com, braindetox.kr, llmreference.com, secondary](https://flaviocopes.com/clef/)).
- **Unknown:** whether the Workers AI request has any sampling or temperature field, and whether identical requests return identical probabilities. Self-hosted weights could be tested directly.

### 3.4 Training data and lookahead
- "Its training datasets aren't public" (Cloudflare's Michelle Chen, to The Register) ([WebSearch summary, secondary](https://www.theregister.com/a/5300649)).
- Training used label-smoothed cross-entropy, a Brier loss for calibration, and RLCD [secondary].
- The backbones are general-purpose Qwen models pre-trained on web-scale text. No cutoff was found for either backbone.
- **This is the highest lookahead exposure of the three.** A 27B or 9B general LLM backbone, frozen, trained on web data that very likely covers market commentary from 2019–2026, is the most likely of the three to "know" what happened on a given date. (This is an inference from the architecture; the data is undisclosed.)

### 3.5 Input
- **Input types:**
  - Clef: 64k-token context; text, JSON, images and video;
  - up to 64 typed questions per call;
  - Clef-omni adds audio, with 64k context ([WebSearch summary of letsdatascience.com, braindetox.kr, techenclave.com, secondary](https://letsdatascience.com/news/cloudflare-releases-open-weight-clef-decision-models-c52886d6)).
- **Context conflict:** OpenRouter lists 65,536 tokens for Clef. Aggregators give 262,144 (presumably the self-hosted figure) [secondary].
- **Python:** no Cloudflare Clef client was found on PyPI. The options are the Workers AI REST API, OpenRouter's API, or (if the Jev compatibility holds) `typesafe-sdk` pointed at a compatible base URL via `TYPESAFE_BASE_URL`. That last option is unverified.

### 3.6 Cost and speed
- **Hosted price, input only, output not billed** ([WebSearch summaries of cryptobriefing.com, openrouter.ai, techenclave.com, secondary](https://openrouter.ai/compare/cloudflare/clef)):
  - Clef: $0.24 per 1M;
  - Clef-flash: $0.038 per 1M since 9 Oct 2026, $0.09 at launch;
  - Clef-omni: $0.15 per 1M;
  - OpenRouter adds 5% on pay-as-you-go.
- **Speed:** Cloudflare reports a 38.8 ms median for Clef-flash, against 524.1 ms for Jev ([WebSearch summary, secondary](https://cryptobriefing.com/cloudflare-clef-decision-models-workers-ai/)). No figure was found for Clef 27B.

### 3.7 Benchmarks, calibration, finance
- **All of these are Cloudflare's own numbers, none independently reproduced** ([WebSearch summary of testmuai.com, letsdatascience.com, secondary](https://www.testmuai.com/blog/cloudflare-clef/)):
  - BANKING77 macro-F1: Clef 94.20, Jev 79.74;
  - BFCL: Clef 98.5, Clef-flash 98.8, Jev 95.8;
  - API-Bank: Clef 91.9, Clef-flash 93.1, Jev 88.2;
  - Jev leads on When2Call (80.97 against 72.37) and BRIGHT (47.52 against 45.91);
  - Clef was best on 7 of 10 benchmarks.
- **No ECE figure was found.** Clef's `confidence` "shows how concentrated the probabilities are, and it isn't the chance the answer is right" [secondary].
- **Finance:** none found. The CLEF-2026 FinMMEval lab (Buy/Hold/Sell from price series and news) is an unrelated academic benchmark that shares the name ([arXiv 2602.10886, via search](https://arxiv.org/pdf/2602.10886)).

## 4. Cost for the bot (arithmetic, not a quote)

Assume one decision call carries about 4,000 input tokens: sixty 1-minute bars as compact text plus the questions. This size is an assumption, not a measurement. At 60 decisions a day that is about 240k input tokens a day. A 2019–2026 backtest is about 7 years × about 250 sessions × 60, which is about 105,000 decisions or about 420M tokens.

| | per live day | full 2019–2026 backtest | latency per call |
|---|---|---|---|
| Jev ($0.042/M) | ≈ $0.01 | ≈ $18 | ~90–525 ms (conflicting reports) |
| Clef ($0.24/M) | ≈ $0.06 | ≈ $100 | unknown |
| Clef-flash ($0.038/M; hosted context 24,576) | ≈ $0.01 | ≈ $16 | ~39 ms (vendor) |
| Laya (self-hosted) | $0 plus hardware | $0 plus hardware | ~33–40 ms on a T4 (vendor) |

Sixty decisions a day spread over one hour is about one a minute. All four are fast enough for 1-minute bars. Cost is negligible at this volume for every option. The backtest is the only place cost adds up.

## What this means for the bot

### Backtest repeatability
- **The backtest and the live bot must call the identical model.** If they don't, the backtest is not measuring the live strategy.
- **Laya and self-hosted Clef weights can be pinned to a commit hash.** That is the strongest guarantee available here. Laya additionally ships reviewed SHAs and SHA-256 checks [primary]. Repeatability then still needs the same device, dtype and batch shape, because Laya documents floating-point drift across those [primary].
- **Jev can only be pinned to a versioned model name.** The response's `model` field records what actually answered [primary]. But the vendor can retire a version on 30–60 days' notice [secondary]. A backtest re-run after that cannot reproduce the calls, unless every response was cached at the time.
- **Hosted Clef has no visible version pin**, and its hosted spec has already changed once [secondary].
- **A common mitigation for any hosted model** is to cache each `(state, questions, model) → answers` pair from the backtest and from live, so that later runs replay stored answers. That makes runs repeatable, but only against the version that was recorded.
- **Not settled by any source:** whether an identical request gives identical probabilities on any of the hosted APIs.

### Lookahead risk
- None of the three publishes a training-data cutoff or a list of training sources that rules out market data.
- **How exposed each model is**, judged from its architecture (an inference, not a disclosed fact):
  - **Clef** (frozen 9B/27B general Qwen LLM): largest;
  - **Jev**: undisclosed size, reportedly synthetic data from an unknown generator;
  - **Laya** (sub-500M encoder, ModernBERT pre-training predating late 2024): smallest.
- **The leak paths:**
  - **Explicit context in the state.** A model may recognise dates, absolute price levels, or news-like context in the state.
  - **Implicit context.** The *pattern* of recent bars is a weaker clue.
- **Mitigations a later ticket could weigh:**
  - strip dates from the state;
  - pass prices relative to the Window open, or in ticks, rather than absolute levels;
  - measure backtest performance separately on data after the model's release (from Sept–Oct 2026 onward) and compare it with earlier years.

### Where a model could fit
- **Judgment calls inside the Setup.** The Silver Bullet research (`docs/research/ict-silver-bullet.md`) leaves several calls open: "is this move a displacement?" and "which liquidity pool is the draw?".
  - These map onto `noul` (displacement yes/no) and `choice` (draw: previous-day high, previous-day low, session high/low, and so on).
  - Each needs the recent bars and key levels as the state.
  - Context sizes: Laya's 512–1,024-token default is tight for 60 bars, Jev's 32k and hosted Clef-flash's 24,576 are ample, and Clef's 64k is roomy.
- **A take/skip filter on Signals.** The deterministic Setup produces a Signal, and the model returns P(take) or a `score` for quality.
  - This keeps the model outside the rule definitions, and it is the easiest to switch off and compare in the backtest.
- **Accuracy evidence for either use is thin.**
  - No published result shows any of the three on futures or price-bar data.
  - The one time-series test found (BetOnAI, crypto, 15-minute direction) had no model, LLMs included, beating a coin flip [secondary].
  - Laya's vendor states its base checkpoints are near chance zero-shot on typed decisions and need fine-tuning [primary].
  - Any of these would need to show, in the backtest, that it adds something over the Setup's own rules.
- **Charts as images:** possible only on Jev (experimental, opt-in) and Clef or Clef-omni. Laya has no image input found. Bars as text work on all three.

## Biggest unknowns (only the blocked vendor pages could settle these)

1. **Hosted repeatability.** Does the same request return identical probabilities on Jev and on Workers AI Clef? Is there any hidden sampling or temperature parameter?
2. **Pinning on hosted models.** Can a versioned Jev ID (for example `jev-1.13.0`) still change under the same name? Does Workers AI give `@cf/cloudflare/clef` versions or revision pins, and what is its change-notice policy?
3. **Training data.** No cutoffs or sources for any of the three: Jev's synthetic-data generator, Clef's post-training data and Qwen backbone cutoffs, Laya's training corpus. The human-annotated versus teacher-labelled question is a conflict.
4. **Clef's model card.** The exact backbone ("Qwen3.8" or a typo), the self-hosted context length (64k against 256k/262,144), the VRAM needs per precision, any ECE figures, and the Python loading path for the schema head.
5. **Jev context and image details.** The base window per version (32k or 64k), and the exact opt-in headers for images and long context.
6. **Laya's link to laya-ai.com and `ai-ml-space/laya`**, and Vercel pricing after 31 Oct 2026.
