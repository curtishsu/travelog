# Travelog Demo Plan

## Goal
Create a short product demo that shows what Travelog can do.

Use cases:
1. Share with recruiters as a portfolio demo.
2. Share with potential users as a product walkthrough.

## Polished Voiceover Script
Travelog is a simple way to remember your travels.

Each time you take a trip, you can record when you went, who you traveled with, and why you went.

You can also log where you were each day, write about your experiences, and save memorable photos.

Once your trips are logged, you can explore the globe to see where you have been and get ideas for where to go next.

You can also view key stats, like total days traveled and who you travel with most often.

## Shot List And Timing
Format: `A` = audio, `V` = video

1.
A: Travelog is a simple way to remember your travels.
V: On the homepage (journal list), slowly scroll through all demo trips.

2.
A: Each time you take a trip, you can record when you went, who you traveled with, and why you went.
V: Open one trip and stay on the Overview tab in edit mode. Scroll to show dates, companions, and trip types.

3.
A: You can also log where you were each day, write about your experiences, and save memorable photos.
V: Open Day 1 in edit mode and scroll through locations, journal entry, hashtags, and photos.

4.
A: Once your trips are logged, you can explore the globe to see where you have been and get ideas for where to go next.
V: Go to the Globe page and rotate the globe to highlight multiple visited regions.

5.
A: You can also view key stats, like total days traveled and who you travel with most often.
V: Open the Stats page and scroll through summary cards and distribution charts.

## Production Notes
1. Seed a demo account with ten fully populated trips.
2. Generate TTS narration from the polished script.
3. Capture footage in the exact shot order above.

## Run Commands
1. Seed demo data:
`npm run demo:seed`

2. Generate OpenAI TTS clips + full narration:
`OPENAI_API_KEY=... npm run demo:tts`

3. Capture deployed footage (1080p):
`DEMO_BASE_URL=https://your-deployed-url.com npm run demo:capture`

4. Stitch clips + narration into one mp4:
`npm run demo:stitch`

5. Full one-command render:
`DEMO_BASE_URL=https://your-deployed-url.com OPENAI_API_KEY=... npm run demo:render`

Optional auth env if deployed site requires sign-in:
`DEMO_USER_EMAIL=test1@test.com`
`DEMO_USER_PASSWORD=testtest`
