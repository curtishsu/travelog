Overall goal:

- Currently, the journal and globe show all places that a user has ever been
- I want to be able to filter both my journal and the globe to find relevant trips

### Globe Filter

- Currently, the globe shows all places that a user has ever been.
- I want to be able to filter it by an assortment of dimensions

Functionality:

- User can filter the globe by
    - Trip Type
        - if a trip has the trip types, then include it
    - Trip people
    - Trip Group
    - Dates of Trip
        - Date range
        - Go by travel days. If a trip has any travel days in the range, count it
- Once a filter is turned on, then the dots will be udpated
- There is a way to clear filter
- Filters are restarted when the app is closed
- Filter semantics (important)
    - Multiple filter clauses combine with AND (each new clause narrows results)
    - Multi-select values within a clause use OR (match ANY selected value)
        - Trip people: trip matches if it includes ANY selected person

User Flow:

- Button at the top right of the globe saying ‘filter’
- Click on it opens up an interstitial
    - There is one filter option, where I can choose based on a drop down menu:
        - Date Range:
            - Use the same start and end date UI when determing the trip ranges
        - Trip Type
            - Multi-select of all the trip types that are eligible
        - Trip Group
            - Multi-select of all the trips that have ever been done
        - Trip people
            - Multi-select of all the people that have been on a trip
    - There is a button under the first filter option that says ‘+ filter’
        - This enables a second filter. Filters can be combined.
    - Button that says ‘Filter’ at the bottom’
    - ‘X’ at thet op
    - When click on filter, then filter for trips that match

### Globe Group By

Goal: I want to see how where I go changes based on time or where I’m going:

Solution & Functionality:

- Create a group by function that color codes locations and countries on the globe based on a group by filter
- A user can choose to group by
    - Trip Type
    - Year
- To prevent overcrowding of colors, only 6 colors are available: these are the top 5 popular locations and an others: the colors are
    - Blue
    - Green
    - Yellow
    - Purple
    - Red
    - Orange
- If a location has multiple group by’s applied to it, split it in half.
    - For example, if a location has been visited by 2025 and 2023, in which 2025 maps to green and 2023 maps to yellow, the location icon should be striped yellow and green

User Flow

- Button at the top right next to ‘filter’ that says Group By. Upon clicking it, a small drop down of year, trip type, and clear appear. Only one can be clicked. Clicking it causes the locations to be grouped by that one
- if another group by is clicked, then the other ones are removed. If clear is clicked, then all group bys are removed