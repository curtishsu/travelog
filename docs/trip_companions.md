Goal of Feature:

- See who you travel with the most and see what you guys do
- Be able to quickly see what trips you’ve been on with someone
    - See what trips you’ve been on with someone (both on the stats page and on the globe)

- Companions are visible in Guest Mode, but can only be edited when not in Guest Mode.

### Product requirements

- Two entities: a person and a group
    - A person has a first name and an optional last name.
        - People are unique by (first_name, last_name) per user, case-insensitive. Empty last_name is allowed.
    - A group consists of people.
        - Group names are unique per user, case-insensitive. If a group already exists, throw an error.
- Each person can be mapped to multiple groups
- A trip can have multiple people. They can have both a group and individual people. If a person is there with group, dedupe. If a group is attached to a trip, that implies all people are on that trip
- People are unique first_name, last_name is case insensitive. Last names are not required.
- Storage model (Option A / dynamic):
    - The trip stores selected group_ids and person_ids.
    - Trip companion people = (all members of selected groups) ∪ (selected people), deduped by person_id.
    - Because groups are referenced (not snapshotted), edits to group membership impact historical trips.

### Product flow

1. Assigning people to a group
2. Under Trip Group:
    1. A user can input either a person’s name or a group
        1. Once someone starts typing, then either a group or person will show up if they have already been added to a previous trip. 
            1. If the name does not exist and the user presses enter, then a ‘New Character’ interstitial pops up. This will be addressed below. 
        2. Groups should have a dark green outline
        3. Person will have blue outline. Both are left aligned, but all groups should be presented before person names
        4. Upon clicking the group or person, that person or group of people is added to the trip
        5. The group names or person names that are selected appear above the text box and below “Trip Group” text.
            - The trip stores group_ids and person_ids (not a snapshot), so group membership edits impact historical trips.

**New Character Flow:**

1. If a user clicks enter on the ‘Trip Group’ stage, then an interstitial shows up
2. At the top of the interstitial is a Title saying ‘New Character’
    1. There is a toggle for ‘Person’ (Default) or Group’
        1. If Person, then there is a text box for First Name and Last Name
            1. text that has already been inputted is prefilled into First Name. if there is a space in the text, then the text after the first space is the last name
        2. If Group:
            1. Group Name Text Box
            2. Below is three “First Name” “Last Name” Text Boxes
                1. When a name is starting to be typed, if there is a person who already exists that has the same name, the suggestions can pulled in as suggestions as chips
                2. Clicking on the chip causes the name to be filled with first and last name
                3. If the user fills out the name with no suggestion and then saves, then this automatically creates a new ‘person’ in the database. 
            3. If all three boxes are filled, then a fourth box is filled. 
                1. Box is scrollable if too long
        3. Bottom is ‘Saved’
            1. If Saved, then all the people and groups created are saved

### Editing Flow

Source: On the settings page:

Goal: Enable the user to change the name of people, the name of groups, and which people are in which groups:
**User flow**
There is a ‘Trip Group’ section:

- There is a toggle for ‘People’ and ‘Group’
- When toggle is set to People:
    - Output is a table of all people. Columns are
        - Name:
            - First Name and Last Name
        - Groups
            - Each Group name is a chip
    - When click on a row: an intersitital appears person’s name is at the top with all the groups below as chips with [x] on the right.
        - Clicking on the [x] removes that person from the group
        - The First and Last Name are editable text fields
    - There is a ‘save’ button at the bottom of interstitial to lock in change
        - When a name change is switched, this cascades to all instances that name is changed. All groups and trips with that person_id is changed to match the new
- When toggle is set to ‘Group’
    - Output is a table of Groups. Columns are:
        - Group: Name of Group
        - People in group (comma separated)
    - When you click into the group, an interstitial appears that enables the user to edit the group
        - Header is the name of the group; by clicking into it, the name of the group can be edited
        - Below is a label that says ‘Group members’
            - A list of all people in the group as first name last name. The design is similar to the ‘New Character’ flow. This can’t be clicked into normally, but there are three vertical dots next to each name. Clicking on it has a drop down of ‘Remove from group’ or ‘edit name’
                - Edit name enables the user to change the name of the user. This change in name cascades.
                - Remove from group removes the user to edit the group
            - There is also a First and Last Name field at bottom to allow a new person to get added to a group.
        - Removing or adding someone to a group should will change all historical trips.
If a user removes or adds a member, there should be warning text above the save button at the bottom of the interstitial saying: 'Group changes will impact historical trips. Are you sure?'
Bottom has 'Discard Chagnes' and 'Save' button
Upon clicking 'Save' then changes all historical data


## Stats
Include a 'trip group' section in Stats page
This should have same functionality as the trip types section
Small button on the top right that says 'person' and 'group'
### Person: 
When clicking person, show a bar chart with the top people I have traveled with. If a person is in the group that I have traveled with, then the trip should be attributed to the person. Upon clicking on a person, I should see all the trips I have traveled with that person
If the toggle is set to Trip group, then it should show the top trip groups. Clicking on the tool tip shows all the trips went with that group

Metrics are based on a # trips basis. 
On click/hover, the tooltrip lists of trips
