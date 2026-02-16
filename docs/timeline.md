There is a button on the globe that says ‘Show Timeline’. Upon clicking there is a ‘timeline feature that appears. As a starter, we will have this appear as a new page, but this can eventually be integrated into the Globe feature. 

The timeline page and feature

- At the top of the screen is the [month year] It progresses at a base speed (e.g. Jan 2019).
- The locations appear in chronological order. The date at the top corresponds with the locations that were traveled to during that month.
    - If there are no locations traveled that month, then it ticks at one second
    - If there is a trip that occurred during the month with a new pin, then the pins should appear in chronological error. For example:
        - If there is a trip with two cities, then it should show the first city visited, and then the second city visited
        - If a trip has the same cities in multiple days, then it only shows the first city.
    - When a new city is shown, then the globe view centers on it
    - A location apperas per trip. If a city appears again on another location, then it should appear again. 
- The locations on the map appear in chronological order. It starts with the first day the user traveled and the city location pins appear in chronological order
- There is a box of stats at the bottom. The metrics update as the pins appear.
    - Number of travel days
    - Number of Trips
    - Number of unique countries
- Pacing:
    - If a month has no trips, then it should only past for a second.
    - a new pin appearing should be the same as if the new location was clicked on
    - If a day is marked as a favorite, then have the highlight pop up for 3 seconds for the user to read before closing and moving on.
    - the month at the top should move as fast as the locations appearing. A month with no travel moves immediately. If there are multiple cities appearing, then it shouldn't mvoe on to the next month until all the locations appear
- Exiting the flow: There is an x at the top right of the page. If it is clicked, then return to the globe.


Improvements: 

- The pacing needs improvement:
    - If going to a new location, it should have the same pacing as if that location was just clicked
- I want to see location name every time a new location appears
- If there are photos, include them sometimes.
- Date (month and year) are not clear enough at the top of the headings: They should be centered and larger
- The stats at the bottom are not clear enough

Implementation decisions (locked)

- Photo moments:
    - If the day has photos, show a photo card with a 35% chance on each new location step.
- Location card behavior:
    - Show only the most recent city on each step.
    - Hide the location card between steps, then show it again for the new city.
- Date line behavior:
    - Keep the date line identical while stepping through multiple city updates on the same day.

## v3 Improvements
Stats are incorrect.
- Days: this should be total days traveled. Thus, even if it is one location, the days incremented should be updated by the total number of travel days. 
- Trips: Update this to be Cities. This should be the count of total unique cities visited across all trips

New Location. 
If a location is showing up as a location for the first time. Have it be noticeable. Examples include having the pin be gold for that iteration

Banner Metadata:
Remove the 'Now Visitng' text