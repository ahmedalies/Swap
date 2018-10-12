this milestone contains:
1-Admin
    a- add new category(interest).
2-User
    1- Auth (login - register) -> remains activating users by email.
    2- Add items for swapping.
    3- Ask for swap by providing -> needy item and provided item.
          swap request only acceptable if the two items in the swap operation is indicating as AVAILABLE 
    4- User get:
        a- completed swaps.
        b- running swaps.
        c- rejected swaps.
    5- Respond to incoming requests with acceptance or rejection.
    6- Rate request operation before 24 hours period of time or he/she get blocked from all action within application
       but still can view all details but no actions taken.
       
       
       
                        --Item states--
available - blocked - in-review - rejected - in-swapping - swapped
----------------------------------------------------------------------
 -available -> indicates item available for swapping
 -in-review -> item goes in-review on   admin due to report or 1 week policy or
      republish
 -blocked -> item blocked by admin due report or 1 week period
      without requests or not accepting request
            1- blocked for report
            2- blocked for 1 week policy without requests
            3- blocked for 1 week policy without accepting requests
 -rejected -> rejected by admin after in-review state
 -in-swapping -> after accepting request within 24 hours
 -swapped -> item has been swapped


              -request states-
 ongoing - accepted - rejected - canceled
 -----------------------------------------
 -ongoing -> swap request is sent to owner - no confirmation yet
 -accepted -> swap request is accepted by owner
 -rejected -> swap request is rejected by owner
 -canceled -> all remain swap requests is canceled by system when needyUser's request to swap is accepted
        in one swap request(by system -only-)

