# Goal:

For New Users, they are not able to fully utilize the features of Travelog because they do not have any past journals on it. The goal is to create a simple touch UI that enables them to create a lot of entries at once and then enable them to onboard.

Entry points: 

- Have a journal sized entry point that says ‘Build Your Travel History’’ with subtext saying ‘Add Past Trips to See Where You’ve Been’ under the Header.
    - Clicking anywhere on the entry point goes to Build Your Travel History page

**UI / UX:**

- Header:
    - Build Your Travel History
- Subheader (italics under the header):
    - Build out your travel history by adding the places you've already been. Click the ‘More’ button to add specific details. To add journal entries, click into the trip on the journal tab
    - Progress indicator: The goal is five trips, so have five segments. With each card filled with all required information, have an additional segment filled. Once all five segments are filled, the globe button is now available. Clicking it saves the five trips and goes to the globe.
    - There is a CTA next to it that says ‘Globe’ that is greyed out
- Body:
- Page is multiple collapsible cards, with each card corresponding to a trip. Each trip name is the header with a small arrow indicating it can be collapsed
    - The metadata to be quickly added on the card are below and called columns
    - Each value in the collapsible is a place to input data.
- There should be three cards available to input on landing. Once all three cards have a trip name, a fourth card should be created
- Only one card is expanded at a time
- At the bottom is a button that says ‘Clear’ and ‘Save’
    - Upon clicking save, all the trips are created and the user is taken to the globe.

UX:

- Once a user has added 4 trips, have a quick pop up that says ‘save to see your progress’
- Upon clicking, the user is taken to the globe with new locations
- If a user entered the globe view via the quick add page, then there is a cta button above the map saying (add more trips) that takes them to the quick add apge

**Columns**

- Trip Name (required)
    - Trip names cannot be duplicated
- Trip Date (required):
    - month and year of trip.
    - UI should be easily to choose month and year when clicked into it.
    - Default is current month and year
- Trip Length (days) (required)
    - If a trip length is greater than the length of the month, set the end date in the next month.
    - E.g. if February 2025 is the month and the trip length is 30, the end date is in March
- Locations on trip (enable multiple locations)
    - This should be based on the mapbox api. Clicking into it has the same search bar functionality as when clicking it into a journal
- Hashtags for trip
- More button at top right
    - Upon clicking, the overview page shows up for that trip, with the trip name, start date, end date, and trip types filled with what was inputted in that row
    - If a user fills in more details, this metadata should flow to when the journal entry is created.
- Duplicate button
    - Creates a duplicate card below with all the same details
    - The trip name is suffixed with (n) where n is incremented to avoid duplicated title names

Assumptions to be made

- Date of travel
    - Assume that the trip started on the 1st of the month and lasted the days inputted
- Locations: Assume that the user was at the same location for all the days
    - if the user inputted multiple locations, then evenly spread them through the locations. e.g. if there were 6 days and 2 locations, then location 1 for the first 3 days and location 2 for the next 3 days.
    - If there were 8 days and 3 locations, then give the remainder to the first locations, then location 1 for 3 days, location 2 for 3 days, and location 3 for 2 days
    - if location count > days, then put multiple locations on each day. Start with putting location 1 and 2 on the same date, 3 and 4 on the same date. There should always be at least one location per day.
    - If 0 locations, that is okay
    - Logic is deterministic. Something like: daysPerLocation = floor(days / locations)
    remainder = days % locations

Potential Errors and guardrails

- Duplicate trip names. If a trip name entered shares the same trip name as another trip name in the table or with a previous trip already entered by the user, have red text saying ‘cannot have duplicate trip names’ and do not let the user click save
- Days input numeric only
- Soft cap like max 365 days
- Do not auto generate the entries