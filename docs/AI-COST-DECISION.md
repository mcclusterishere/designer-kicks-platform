# The Heat Chart: AI Model and Cost Decision

Prepared 31 July 2026.

## 1. THE ANSWER

No, you do not have to load money onto Gemini today to keep the site running. There is a real free tier and your current volume almost certainly fits inside it. But you should put money on it anyway, and the reason is not capacity. It is privacy. On the free tier, Google says in its own pricing documentation that it uses your prompts and the model's responses to improve Google products, and that human reviewers may read them. That means the text of customer DMs and comments from your Facebook Page. Linking a billing account switches that off. That is the whole argument for paying.

The cost of paying is small. At today's volume of roughly 200 model calls a day, on the model I recommend below, you would spend about seven dollars a month. At 50 calls a day it is closer to two dollars a month. If your growth push works and you hit 20 times today's volume, meaning about 4,000 calls a day, you would spend about 146 dollars a month.

My recommendation is to link a billing account and set a budget alert at 25 dollars a month. Put 20 dollars on it if the console asks for a prepaid balance. That covers several months at today's size and gives you room to grow before you have to think about it again.

One warning that belongs in this section because it costs real money. Your code has an option to turn on Google Search grounding for a call. Google gives you 5,000 grounded searches a month free and then charges 14 dollars per 1,000 searches. At 200 calls a day, if every single call used search, you would be at about 6,000 a month and would pay roughly 14 dollars on top of the seven. Use search grounding only where it genuinely helps, such as drop dates and release news, and not on routine comment replies.

## 2. THE LIGHTEST GEMINI

The lineup you are on no longer exists. This is the most important technical fact in this document. Your code currently asks for gemini-2.5-flash first and falls back to gemini-2.0-flash. Google shut gemini-2.0-flash down permanently on 1 June 2026, so that fallback is dead code that can only ever fail. Google's official schedule says gemini-2.5-flash shuts down on 16 October 2026, which is about eleven weeks away, and multiple developer forum reports say it actually started returning "no longer available" errors around 9 July 2026. I could not read Google's own deprecation page from this environment to confirm the early shutdown, so treat the July date as strong but unverified. Either way, both of your model IDs are on borrowed time and one of them is already gone.

The absolute cheapest Gemini model still listed with a price today is gemini-2.5-flash-lite at ten cents per million input tokens and forty cents per million output tokens. I am not recommending it. It is scheduled to die on the same 16 October date and may already be returning errors, so switching to it would buy you a few weeks and then force a second migration.

The model I recommend is gemini-3.1-flash-lite. It costs 25 cents per million input tokens and one dollar fifty per million output tokens. It is generally available and stable, it is the cheapest model in the current Gemini 3 generation, and it is the correct long term target. Google's own price table on the Vertex AI pricing page confirms those two numbers directly.

On the sneaker photo question, the good news is that you do not need a two model split. The 25 cent input price for gemini-3.1-flash-lite explicitly covers text, image and video input in a single rate. It does vision. Your poll photo call works on the same cheap model as your comment replies.

Photo cost is negligible and it is worth understanding why, because you mentioned six megabyte images. File size does not drive the price. Pixel dimensions do. Gemini converts an image into tokens, and on the Gemini 3 models you can set that explicitly with a setting called media resolution, which uses 280 tokens for low, 560 for medium, and 1,120 for high. At the most expensive of those, one photo costs about 28 hundredths of a cent in input, which is roughly 3,500 photos per dollar. If you do not set that value the model picks its own, so per photo cost is not predictable unless you pin it. For identifying which sneakers are in a poll photo, set it to medium and you will pay about 14 hundredths of a cent per image.

For a fallback, use gemini-3.5-flash-lite, which is 30 cents input and two dollars fifty output. It is slightly more expensive so it should be second in line, not first.

Do not use the model ID gemini-flash-latest or any other name ending in "latest". A developer reported that Google silently repointed that alias to a much more expensive model with extended reasoning turned on by default and their credits drained about ten times faster than expected. I could not read that forum thread directly, so treat it as a reported incident rather than a confirmed fact, but the safe practice is the same regardless: always pin an exact model ID.

## 3. THE FREE TIER

There is a genuine free tier on the Gemini API, and Google's pricing page marks both input and output as free of charge on it for the Flash and Flash-Lite models. That is the class of model you would be using, so in principle your whole workload could run at zero.

Here is the honest problem with giving you plain numbers for the limits. Google has stopped publishing a fixed public table of free tier rate limits. Their rate limits page now tells developers to look in the Google AI Studio console for the actual numbers on their own project. On top of that, the page itself was unreachable from where I did this research, so everything I have on limits is second hand. Third party trackers give conflicting figures: some say 10 requests per minute and 1,500 requests per day, others say 30 requests per minute and 1,000 per day, and older sources say 15 per minute. I will not pretend any one of those is correct.

What I can say with confidence is this. Every one of those conflicting figures is comfortably above your current volume. One comment every ten to twenty minutes is roughly three to six calls per hour, well under even a ten per minute cap, and 50 to 200 calls a day is well under even a 1,000 per day cap. Your traffic today fits inside the free tier with a lot of room.

The point where you would break through is roughly 1,000 to 1,500 calls a day, which is somewhere between five and thirty times your current volume depending on which of those unverified limits is real. Your stated growth ambition of 10 to 50 times would blow through it. The per minute limit is the one that would bite first and most confusingly, because a single viral post could produce twenty comments in a minute and you would start getting rejections in a burst even though your daily total was fine.

The catch is the one I led with. Free tier prompts and responses are used by Google to improve its products and human reviewers may read them. Paid tier prompts and responses are not. Google states this directly on its pricing page and marks free tier data use as "yes" and paid tier as "no". Your chatbot handles private customer messages. That alone is worth seven dollars a month.

Two smaller notes. Context caching, which is the feature that would cut the cost of your long system prompts, is not available on the free tier at all. And failed requests are not billed on the paid tier, so retries against a bad model ID do not cost you anything.

To read your actual free tier numbers, open Google AI Studio, select the project your GEMINI_API_KEY belongs to, and look at the rate limits shown there for the specific model.

## 4. THE NONPROFIT ANGLE

The honest answer is no. Your nonprofit cannot legitimately pay for The Heat Chart's chatbot, and I want to be plain about that rather than encouraging.

There are two separate reasons, and each one is sufficient on its own.

The first is that the product does not exist. Google for Nonprofits gives you AI inside Google Workspace: the Gemini app, NotebookLM, Deep Research, and AI help inside Gmail, Docs and Sheets, for up to 2,000 users at no cost. Those are things a person sits down and uses. There is no API key in that bundle, no developer quota, and nothing that a website or a Facebook chatbot can call. "Gemini in Workspace" and "the Gemini API for developers" are two different products that happen to share a name. Your code consumes the second one. The nonprofit program gives you the first one.

Google for Nonprofits does now appear to have a Google Cloud Credits benefit, which is the only nonprofit benefit that could in principle pay a Gemini API bill. I could not read that help article because the host was blocked, and secondary sources disagree wildly on the amount, quoting 500 dollars, 1,000 dollars and 10,000 dollars a year. I am not going to give you a number I could not verify.

The second reason is the one that actually settles it, and it applies no matter what that credit amount turns out to be. Nonprofit credits are restricted to the nonprofit's charitable mission and not for commercial use. The Heat Chart has affiliate redirects, Stripe checkout, consignment commissions and eBay spread. It is a commercial business. Pointing charitable credits at its inference bill is using them for commercial purposes. Google separates these tracks deliberately: their Google for Startups Cloud Program page lists nonprofits by name among the entity types it will not accept, right alongside government entities and educational institutions. I should flag that the exact contractual wording of the nonprofit commercial use restriction comes from search summaries rather than from the terms page itself, because that host was unreachable, so read it in the console before you rely on the precise phrasing. The restriction itself is real.

The downside of getting this wrong is not a refund request. It is termination of the Google account, and that is the same Google identity that holds your analytics and your API keys. For seven dollars a month, it is not a risk worth taking.

There is a related trap worth knowing about even though you did not ask. The Google Ad Grants program, which is the benefit most nonprofits actually want, bars websites that carry affiliate marketing links or that primarily send traffic elsewhere through affiliate links. Your affiliate redirect layer and your "where to buy" modules would violate that policy. Do not point Ad Grants at theheatchart.com.

What the nonprofit legitimately can use, right now, at no cost: Google Workspace for Nonprofits including the Gemini app and NotebookLM for its own staff, for its own charitable work. Writing grant applications, summarizing documents, drafting newsletters, organizing program data. That is genuinely valuable and you should apply for it. US eligibility requires IRS 501(c)(3) recognition, and verification now runs through a partner called Goodstack, which replaced TechSoup. Verification typically takes one to five business days.

If you want a credit program that could legitimately fund the sneaker business, the honest path is the commercial one, not the charitable one. Google Cloud gives new customers 300 dollars in free credit. At seven dollars a month, that alone would cover roughly three and a half years of your current AI usage. That is the single best free money available to you, it has no eligibility problem, and it takes about ten minutes to claim. One caveat so you are not surprised: Google Cloud's permanent free tier advertises free monthly usage of "AI APIs", but that refers to their older vision and speech products, not to Gemini. Gemini bills from the first token and draws down the 300 dollars.

There is also the Google for Startups Cloud Program Start tier at up to 2,000 dollars in credits for one year, but it requires that the company was founded within the last 24 months and is a technology startup planning to seek venture funding. If The Heat Chart does not fit that description, do not apply.

Finally, the question of whether the nonprofit could contract with the for profit business at fair market value to work around all of this is a tax and legal question about private benefit and unrelated business income, not a technical one. If you want to pursue it, that is a conversation with a nonprofit attorney or CPA, not with me.

## 5. LLAMA AND THE ALTERNATIVES

Llama is real, it is cheap, and switching is not worth your time at this size.

Here are the honest numbers. Meta's own Llama API exists and accepts images, which I confirmed from Meta's published API specification, but I could not reach Meta's pricing page at all and I found contradictory claims about whether that first party service is even still being sold. Their official Python library has not had a release since December 2025. Treat Meta's own Llama service as unknown and do not build on it.

Where Llama is actually cheap is on the companies that host it. Groq serves Llama 4 Scout, which handles images, at 11 cents per million input tokens and 34 cents per million output tokens. DeepInfra serves the same model at 8 cents and 30 cents. Those are the cheapest credible vision capable prices I found. Compare that to gemini-3.1-flash-lite at 25 cents and one dollar fifty. Llama 4 Scout on Groq is genuinely about four times cheaper per token.

Four times cheaper sounds like a lot until you apply it to your actual bill. At today's volume you would go from about seven dollars a month to about two dollars and fifty cents a month. You would save around four dollars and fifty cents a month, in exchange for writing and testing a second API client, a second failure path, a second set of credentials, and a second thing that can break your Facebook chatbot at two in the morning. That is a bad trade.

At 20 times your volume it becomes about 146 dollars a month on Gemini versus roughly 48 dollars on Groq. Saving 98 dollars a month starts to be worth a day of engineering. That is the point to revisit this, not now.

There are two things worth filing away for later. Groq's API is wire compatible with the OpenAI format, and so are DeepInfra, Together, Fireworks and Amazon Bedrock, which means that once you write one client for any of them you can switch between them by changing a URL and a key. And Groq is reported to have a free tier of around 30 requests per minute with no credit card required, which would make a decent emergency fallback if Gemini ever has an outage. I could not verify Groq's free tier limits from Groq's own site because it was unreachable, so check the console before depending on it.

I should be straight about the sourcing on this whole section. Almost every vendor pricing page was blocked from where I did this research. All of the per token prices for Groq, DeepInfra, Together, Fireworks and Bedrock come from a widely used third party price map that was updated the same day I checked it, cross checked against search results where possible, but not read from the vendors themselves. Verify any of them before you spend real money. The Gemini prices, by contrast, I read directly from Google's own pricing page.

## 6. SELF HOSTING KIMI OR GLM

Do not do this. It is not close.

The first thing to know is that these models are enormously bigger than you are picturing. Kimi K3, released four days ago, has 2.8 trillion parameters. GLM-5.2 has 744 billion. The engineering teams who build the serving software publish official recipes for these models, and those recipes specify eight H200 GPUs per machine, which is 1,128 gigabytes of graphics memory in one box. Kimi K3's weights are around 1.4 terabytes, which does not even fit in one such machine, so it needs two.

Renting one eight GPU H200 machine costs between about 18 and 35 dollars an hour depending on the provider. Running it around the clock, which you would have to, because a Facebook chatbot cannot make someone wait while a server boots and loads a terabyte of weights, costs between about 13,400 and 25,600 dollars a month. I am using the most generous, cheapest number I could find, and it is still 13,400 dollars a month.

Against that, your entire AI bill on Gemini is about seven dollars a month. Self hosting becomes cheaper only at about 11 million model calls a month, which is roughly 366,000 calls a day, or about 254 calls every minute sustained day and night. Your best case growth target is 4,000 calls a day. Break even is about 91 times beyond your best case and about 1,800 times beyond where you are now. At today's volume, self hosting works out to roughly two dollars and twenty cents per single chatbot reply, versus about a tenth of a cent on Gemini.

More than 99 percent of that money would be paying for idle graphics cards. The machine is sized to serve hundreds of simultaneous users. You have one comment every fifteen minutes. And that is before the parts nobody quotes you: keeping the serving software matched to driver versions, tuning memory settings, patching an internet reachable server, and being personally on call for the chatbot that answers on the Page your livelihood runs through, with no vendor to call when it stops.

Now the useful part of your question. Yes, both companies sell hosted APIs, and yes, that beats self hosting by an enormous margin. Moonshot serves Kimi K3 at platform.kimi.ai with endpoints compatible with the common formats, so it is close to a drop in swap. Z.ai serves GLM-5.2 on its own platform. Reported prices, which I could not read from either vendor because both sites were blocked, are about one dollar forty per million input and four dollars forty per million output for GLM-5.2, and about three dollars and fifteen dollars for Kimi K3.

For your workload that would come to roughly 29 dollars a month on GLM-5.2 and somewhere between 150 and 200 dollars a month on Kimi K3, versus about seven dollars on Gemini. Kimi is that much worse because K3 always runs with extended reasoning turned on and bills you for those hidden reasoning tokens, with the effort level defaulting to maximum. That is confirmed in Moonshot's own documentation. Moonshot also has no free tier at all: you must top up at least one dollar before the model unlocks, and your rate limits are tied to how much you have paid in total.

One item worth checking if you ever want a free backup: Z.ai reportedly serves a smaller model called GLM-4.7-Flash at zero cost for input and output. I could not verify that because Z.ai's documentation was unreachable. If it is true it would be a genuinely free second provider, but confirm it yourself before designing anything around it.

The short verdict: hosted beats self hosted by about a thousand times, and Gemini beats both hosted Chinese options by four to twenty five times at your size.

## 7. WHAT I RECOMMEND

One path, in order.

Step one, before anything else, confirm what is actually alive. Run this one command with your own key and read the list it returns. It is free, it is read only, and it settles the question of which model IDs still work better than any documentation I could reach.

`curl 'https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_GEMINI_API_KEY'`

If gemini-3.1-flash-lite appears in that list, proceed. If it does not, use gemini-3.5-flash-lite instead and expect to pay about two and a half times more, which is still under twenty dollars a month at today's volume.

Step two, change the model list in the code. In the file lib/gemini.ts there are two identical lines, one at line 50 and one at line 140, that both read:

`: ["gemini-2.5-flash", "gemini-2.0-flash"];`

Both should become:

`: ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];`

That does three things at once. It removes the dead gemini-2.0-flash fallback, it gets you off gemini-2.5-flash before it disappears, and it drops you onto the cheapest current generation model, which also handles the sneaker photo calls.

Step three, fix the other file. lib/onboardAgent.ts at line 112 defaults to gemini-2.0-flash, which has been shut down since 1 June. That file is currently broken whenever GEMINI_MODEL is not set. Change that default to gemini-3.1-flash-lite as well.

Step four, check your production environment for a GEMINI_MODEL variable. If it is set, it overrides everything above and the code change accomplishes nothing. If it is set to any 2.x model ID, either update it or remove it so the code defaults apply. Never set it to gemini-flash-latest or any other name ending in "latest".

Step five, pin the image resolution. Wherever the sneaker photo call is made, set media resolution explicitly to medium. Without it the model chooses on its own and your per photo cost becomes unpredictable. With it set to medium, each photo costs about 14 hundredths of a cent.

Step six, turn on billing. Link a billing account to the project that owns your Gemini key. Claim the 300 dollars in new customer Google Cloud credit while you are there. Set a budget alert at 25 dollars a month so a runaway loop wakes you up rather than surprising you at the end of the month. This is the step that stops Google from training on your customers' messages, and it is worth doing even though the free tier would technically hold your current traffic.

Step seven, before you commit any of this, run the three verification suites and the build, as your project rules require: npm run verify:meta, npm run verify:chatbot, npm run verify:purge, and npm run build. The model list change touches lib/, so all four must pass. Since this changes model selection behavior, add a check in the same pass that fails if the configured model list contains any retired 2.x model ID or any name ending in "latest". That turns this document's main lesson into something the test suite enforces instead of something you have to remember.

Step eight, set a calendar reminder for 1 October 2026 to re-run the model list command from step one. Google is retiring models faster than it announces them, and fifteen minutes of checking twice a year prevents the chatbot going silent on your Page.

Two things not to do. Do not use nonprofit credits for this site. Do not rent GPUs.

One thing to revisit later. If you ever sustain more than about 2,000 calls a day, look again at Groq's Llama 4 Scout, which is about four times cheaper per token and would then be saving you real money rather than pocket change.

## 8. SOURCES AND UNCERTAINTY

The numbers I am most confident in, because I read them directly from Google's own live pricing page at https://cloud.google.com/vertex-ai/generative-ai/pricing on 31 July 2026:

Gemini 3.1 Flash-Lite at 25 cents per million input tokens covering text, image and video, and one dollar fifty per million output tokens. Gemini 3.5 Flash-Lite at 30 cents and two dollars fifty. Gemini 3.6 Flash at one dollar fifty and seven dollars fifty. Gemini 2.5 Flash-Lite at ten cents and forty cents. Cached input at roughly ten percent of the input price. Batch processing at half price with a 24 hour turnaround. The Priority service tier at roughly 1.8 times standard price, which you should make sure is not enabled. Google Search grounding free for 5,000 queries a month and then 14 dollars per 1,000. Failed requests are not billed.

Other sources behind load bearing claims. The Google Cloud free tier and the 300 dollar new customer credit come from https://cloud.google.com/free, read directly. The fact that Google Cloud's startup program excludes nonprofits by name comes from https://cloud.google.com/startup/benefits, read directly. Microsoft's nonprofit Azure grant of 2,000 dollars a year comes from https://www.microsoft.com/en-us/nonprofits, read directly. Kimi K3's size and its always on reasoning behavior come from Moonshot's own README at https://raw.githubusercontent.com/MoonshotAI/Kimi-K3/main/README.md. GLM-5.2's size comes from https://raw.githubusercontent.com/zai-org/GLM-5/main/README.md. The eight GPU hardware requirement comes from the vLLM project's official serving recipes at https://raw.githubusercontent.com/vllm-project/recipes/main/GLM/GLM5.md. Meta's Llama API specification and its image support come from Meta's own published API spec via their SDK repository.

Now the honest list of what I could not verify, and why. A large number of documentation sites were unreachable from where this research was done, and I would rather tell you that than paper over it.

Google's own developer documentation site, ai.google.dev, was completely unreachable. That means I could not read Google's pricing page for the developer API you actually call, their deprecation schedule, or their rate limits page. Everything about free tier limits, everything about shutdown dates, and the exact wording about data use on the free tier comes from search summaries of those pages rather than from the pages themselves. The prices are independently confirmed on the Cloud page I could read, so I am confident in those. The dates and limits are not confirmed by me.

The exact free tier request limits could not be verified at all. Third party trackers give conflicting numbers between 10 and 30 requests per minute and between 1,000 and 1,500 requests per day. Google appears to have stopped publishing these publicly. Read the real number in Google AI Studio for your own project.

Whether gemini-2.5-flash is already dead is unconfirmed. Google's official schedule says 16 October 2026, but developer forum reports say it started failing on 9 July 2026. I could not read those forum threads because that host was blocked either. The single command in step seven of my recommendation resolves this question definitively in about five seconds.

The exact Google for Nonprofits cloud credit amount could not be verified. Sources conflict between 500, 1,000 and 10,000 dollars a year, and the authoritative page was blocked. This does not change my recommendation, because the commercial use restriction rules it out regardless of amount, but you should know the number is unknown.

The exact contractual wording of the nonprofit commercial use restriction could not be read. The restriction is reported consistently across sources and I am confident it is real, but the precise sentence, which is what would matter in a dispute, comes from search summaries. Read it in the Google for Nonprofits console before making any decision that leans on it.

Every non Google vendor pricing page was blocked. That includes Groq, Together, Fireworks, DeepInfra, OpenRouter, Amazon, OpenAI, Mistral, Moonshot and Z.ai. All the Llama, Kimi and GLM prices in this document come from a third party price map and from search results, not from the vendors. They agreed with each other in most cases, but verify before spending.

GPU rental prices were also all secondary, because those vendor sites were blocked as well. I deliberately used the cheapest quoted rate in the break even math so the conclusion holds even if the low end is real.

Finally, the per call token estimates behind my dollar figures are assumptions, not measurements. I assumed about 2,000 input tokens and 300 output tokens for a chatbot reply, about 3,100 input and 200 output for a photo identification call including the image, and about 1,500 input and 2,000 output for an article draft, blended at seventy percent short replies, twenty percent photo calls and ten percent long form. Your system prompt file is large, so your real input counts may well be higher. If they are double my estimate, your bill is roughly double: about 14 dollars a month today rather than seven. Nothing in the recommendation changes at that scale. After a month on the paid tier you will have real usage numbers in the console and can replace my estimate with a fact.