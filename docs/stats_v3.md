The following are fixes to the stats page

Most Visited KPI
1. Fix format the Most visited box. Currently there are brackets around the days visited. Remove the brackets
2. Currently the KPI is measured by number of trips. I want it to be by trips and by dates. To implement this: Have the header say Most Visited (Trip/Days): On click, the metric changes between trips and days, and the word in parantheses updates accordingly. 
3. Handling ties: If there are two locations that are tied for most visited (by trips or locations) then they should be part of the tap rotation. For example, if Las Vegas and San Francisco have both been on five trips, and Seattle has the most days visited, then the KPI should cycle those three cities upon tap. If there is a tie, then next to the city name, it should say "(Tie)". The order of the cards should be most visited trips (and all ties) and then most visited days (and then cycle)


Tool Tip Improvements
1. There is an issue with tool tip where if the user goes off the actual word, then the tool tip disappears. This is bad user flow because it is impossible to click into the links. There should be a delay between hovering over the tool tip and the tool tip disappearing. If the mouse hovers over the tool tip, then it should not disappear. 

Mobile experience with Tool Tips
1. On the tool tip chart, when an interstitial is open, clicking anywhere else on the screen should turn off the tool tip. Currently, this does not work
2. There is an issue where the point to click for the tool tip is slightly above the actual button. The button should be on the interstitial. 
3. On mobile, sometimes the interstitial is not fully on the screen. It should be. 
4. On a mobile screen, when on travel days per month, there are too many labels on the X-axis that the dates cannot be seen. Fix this by only including key data labels so that everything fits. 
5. Remove the "Trip Days" list on the tool tip with just a 'See Trip' button. On clicking this, the list will expand
6. The tooltip is cut off at the bottom if the interstitial is too big. have the interstiital pop upwards only so it doesn't get cut off