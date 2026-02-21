# About the Lead

[set:HubspotHints=[value:missing]]

## Challenge

Our challenge with this company is `[value:company.verso_anliegen]`.
From our perspective, the challenge of the company is `[value:company.verso_herausforderungen_des_kunden]`.

## Contact

This is what our HubSpot knows about the contact.

### Facts

The contacts name is `[value:contact.firstname] [value:contact.lastname]`.  
[condense]
  [if:contact.jobtitle]
    Their job title is "[value:contact.jobtitle]".
  [if-else]
    Their job title is not known. [if:HubspotHints=true]We should add it in HubSpot.[if-end]
  [if-end]
[condense-end]

The contacts email-address is [value:contact.email].  
Their phone number is `[value:contact.phone]`.  
They reside in `[value:contact.city]` ([value:contact.state], [value:contact.country]).

The contact has been created in our HubSpot on [value:contact.createdate date="%d.%m.%Y"].  
They were last modified on [value:contact.lastmodifieddate date="%d.%m.%Y"]. 

### Notes

The notes in HubSpot show how much engagement happeed between the contact and us. 

We have [value:contact.num_notes] notes assosiated with the contact.
The overall number of contacted notes is [value:contact.num_contacted_notes].
The last note updated was on [value:contact.notes_last_updated date="%d.%m.%Y"].
The last note contacted was on [value:contact.notes_last_contacted date="%d.%m.%Y"].
The next note activity will be on [value:contact.notes_next_activity_date date="%d.%m.%Y"].

### Interests

[condense]
  [if:contact.interesse]
    According to their usage of our website, the contact has these interests:  
    `[value:contact.interesse]`
  [if-else]
    We were not able to detect interests of the contact by their usage of our website.
  [if-end]
[condense-end]

---

## Company

This is what our HubSpot knows about the contacts company.

### Facts

The name of the contacts company is `[value:company.name]`. 

[condense]
  [if:company.industry&company.hs_industry_group]
    They are in the `[value:company.industry]` industry (group: `[value:company.hs_industry_group]`). 
  [if-elif:company.industry]
    They are in the `[value:company.industry]` industry.  
    [if:HubspotHints=true]"hs_industry_group" is missing in the HubSpot company.[if-end]
  [if-elif:company.hs_industry_group]
    They are in the industry group `[value:company.hs_industry_group]`. 
    [if:HubspotHints=true]"industry" is missing in the HubSpot company.[if-end]
  [if-else]
    We don't know which industry they are in.
    [if:HubspotHints=true]"industry" and "hs_industry_group" is missing in the HubSpot company.[if-end]
  [if-end]
[condense-end]

[condense]
  [if:company.industry&company.hs_industry_group]
    The tier of the company is `[value:company.tier]`.
  [if-else]
    We don't know which tier they are in.
    [if:HubspotHints=true]"tier" is missing in the HubSpot company.[if-end]
  [if-end]
[condense-end]
[condense]
  [if:company.hs_num_child_companies>0]
    They have [value:company.hs_num_child_companies] child companies. 
  [if-elif:company.hs_num_child_companies=0]
    They have no child companies. 
  [if-else]
    [if:HubspotHints=true]"hs_num_child_companies" is missing in the HubSpot company.[if-end]
  [if-end]
[condense-end]

// They have [value:company.anzahl_der_mitarbeitenden] employees ([value:company.zahl_der_mitarbeitenden] or [value:company.numberofemployees] to be exact). 

[condense]
  [if:company.anzahl_der_mitarbeitenden]
    They have [value:company.anzahl_der_mitarbeitenden] employees.
  [if-else]
    [if:HubspotHints=true]"anzahl_der_mitarbeitenden" is missing in the HubSpot company.[if-end]
  [if-end]
[condense-end]
[condense]
  [if:company.zahl_der_mitarbeitenden]
    They have [value:company.zahl_der_mitarbeitenden] employees.
  [if-else]
    [if:HubspotHints=true]"zahl_der_mitarbeitenden" is missing in the HubSpot company.[if-end]
  [if-end]
[condense-end]
[condense]
  [if:company.numberofemployees]
    They have [value:company.numberofemployees] employees.
  [if-else]
    [if:HubspotHints=true]"numberofemployees" is missing in the HubSpot company.[if-end]
  [if-end]
[condense-end]

The company is located in `[value:company.country]`. [condense]
  [if:company.sitz_in_der_eu=Ja]
    They are in the EU.
  [if-elif:company.sitz_in_der_eu=Nein]
    They are not in the EU.
  [if-else]
    We dont know whether they are in the EU.
    [if:HubspotHints=true]We should add "sitz_in_der_eu" in the HubSpot company.[if-end]
  [if-end]
[condense-end]

The company was founded in [value:company.founded_year]. 
The company website is [[value:company.domain]](https://[value:company.website]).

The company has been created in our HubSpot on [value:company.createdate date="%d.%m.%Y"].
It was last modified on [value:company.hs_lastmodifieddate date="%d.%m.%Y"].

The last open task we have in HubSpot on the company is on [value:company.hs_last_open_task_date date="%d.%m.%Y"].

[condense]
  [if:company.date__turned_into_customer__lifecycle_]
    They became our customer on [value:company.date__turned_into_customer__lifecycle_ date="%d.%m.%Y"].
  [if-end]
[condense-end]
[condense]
  [if:company.days_to_close]
    It took [value:company.days_to_close time="%Y %m %d %H %M %S"] to close the deal.
  [if-end]
[condense-end]

### Description

[condense]
  [if:company.description]
    [value:company.description]
  [if-end]
  [if:company.linkedinbio!=[value:company.description]]
    [value:company.linkedinbio]
  [if-end]
[condense-end]

### Revenue

The annual revenue of the company is [value:company.annualrevenue].
[condense]
  [if:company.annual_recurring_revenue_alle_pipelines>0]
    Recurring revenue of all pipelines is [value:company.annual_recurring_revenue_alle_pipelines].
  [if-end]
[condense-end]

The company has [value:company.hs_num_open_deals] open deals.

### Owner 

The current owner of the contact is [condense]
  [if:[value:hubspot.owner["[value:contact.hubspot_owner_id]"]]]
    `[value:hubspot.owner["[value:contact.hubspot_owner_id]"]]`
  [if-else]
    unknown
  [if-end]
[condense-end].
[condense]
  [if:contact.hs_all_owner_ids[!=[value:contact.hubspot_owner_id]]]
    The owners (including previous owners) are [value:contact.hs_all_owner_ids]. // Andreas: Bedingte Vornamen
  [if-else]
    The contact did not previously have any other owners.
  [if-end]
[condense-end]

The email of the owner of the company is `[value:company.owneremail]`.

### Contacts

In our HubSpot, we have [value:company.num_associated_contacts] contacts associated with that company.
[condense]
  [if:company.hs_num_contacts_with_buying_roles>0]
    * [value:company.hs_num_contacts_with_buying_roles] of these contacts have bying roles.
  [if-end]
  [if:company.hs_num_decision_makers>0]
    * [value:company.hs_num_decision_makers] of these contacts are decision makers.
  [if-end]
[condense-end]

Contacts in the company had [value:company.hs_num_blockers] issues with us in the past.

The first contact created in HubSpot for this company was created on [value:company.first_contact_createdate date="%d.%m.%Y"].

### Notes

- num_notes: [value:company.num_notes]
- num_contacted_notes: [value:company.num_contacted_notes]

- notes_last_contacted: [value:company.notes_last_contacted date="%d.%m.%Y"]
- notes_last_updated: [value:company.notes_last_updated date="%d.%m.%Y"]
- notes_next_activity_date: [value:company.notes_next_activity_date date="%d.%m.%Y"]

- hs_notes_next_activity_type: [value:company.hs_notes_next_activity_type]

- hs_notes_last_activity: [value:company.hs_notes_last_activity date="%d.%m.%Y"]
- hs_notes_next_activity: [value:company.hs_notes_next_activity date="%d.%m.%Y"]

### Sales activities

- hs_last_sales_activity_type: [value:company.hs_last_sales_activity_type]
- hs_last_sales_activity_date: [value:company.hs_last_sales_activity_date date="%d.%m.%Y"]
- hs_last_sales_activity_timestamp: [value:company.hs_last_sales_activity_timestamp date="%d.%m.%Y"]

### Contact data

The companys phone number is `[value:company.phone]`.
The comapnys LinkedIn page is [[value:company.linkedin_company_page]]([value:company.linkedin_company_page]).

### Licensed system

Once a company becomes a customer, we set up their system. 

Here are the links of the company:

- Customer system 1: [value:company.link_kundensystem]
- Customer system 2: [value:company.link_kundensystem_2]
- Customer system 3: [value:company.link_kundensystem_3]

---

## Pipeline

This section provides data from the contacts sales pipeline.

### Acquisition

[condense]
  [if:contact.akquisetyp="Inbound"]
    The contact has found us through search engines or social media, which might include word-of-mouth or a presence of ours at an event/congress. 
    They have not been in direct contact with us (inbound or partner).
  [if-elif:contact.akquisetyp="Partner"]
    The contact likely has a strong relationship to us, e.g. because our partners provided the contact or they are in the same association like we are.
    They have not approached us by themselves (inbound).
  [if-elif:contact.akquisetyp="Outbound"]
    The contact likely has a relation to us, but they do not come from any of our partners and they are most probably not in the same association like we are. 
    They have not approached us by themselves (inbound).
  [if-else]
    The acquisition type is unknown.
  [if-end]
[condense-end]

### Consent

[condense]
  [if:contact.hs_legal_basis]
    The contact has given us this communication consent:  
    `[value:contact.hs_legal_basis]`
  [if-else]
    We do not have consent information about the contact.
  [if-end]
[condense-end]

### Outreach

[condense]
  [if:lead.hs_first_outreach_date date="%d.%m.%Y"]
    The first outreach to the contact happened on [value:contact.hs_first_outreach_date date="%d.%m.%Y"].
  [if-else]
    The contact has not been reached out to yet.
  [if-end]
[condense-end]

### Close

[condense]
  [if:contact.closedate date]
    The deal was closed after [value:contact.days_to_close] days on [value:contact.closedate date="%d.%m.%Y"].
  [if-else]
    No deal has been closed yet.
  [if-end]
[condense-end]

[value:company.closedate="%d.%m.%Y" failure="No close date available"]

### Conversion

The company has had [if:company.num_conversion_events>0][value:company.num_conversion_events][if-else]no[if-end] conversion events.

#### First event

[condense]
  [if:contact.first_conversion_event_name]
    The first conversion event of the contact was `[value:contact.first_conversion_event_name]`.
    It happened on [value:contact.first_conversion_date date="%d.%m.%Y"] after [value:contact.num_conversion_events] conversion events ([value:contact.num_unique_conversion_events] unique).
  [if-else]
    There was no first conversion event of the contact yet.
  [if-end]
[condense-end]

[condense]
  [if:company.first_conversion_event_name]
    The first conversion event of the company was `[value:company.first_conversion_event_name]`.
    It happened on [value:company.first_conversion_date date="%d.%m.%Y"] after [value:company.num_conversion_events] conversion events.
  [if-else]
    There was no first conversion event of the company yet.
  [if-end]
[condense-end]

#### Last event

[condense]
  [if:contact.recent_conversion_event_name]
    The most recent conversion event of the contact was `[value:contact.recent_conversion_event_name]`.
    It happened on the [value:contact.recent_conversion_date date="%d.%m.%Y"].
  [if-else]
    There was no recent conversion event of the contact yet.
  [if-end]
[condense-end]

[condense]
  [if:company.recent_conversion_event_name]
    The most recent conversion event of the contact was `[value:company.recent_conversion_event_name]`.
    It happened on the [value:company.recent_conversion_date date="%d.%m.%Y"].
  [if-else]
    There was no recent conversion event of the contact yet.
  [if-end]
[condense-end]

### Lifecycle

Contacts are put into lifecycle stages to classify their lead status. 
Not every contact is a lead, though. 

#### Stages

Our lifecycle stages are
- Stages before being a customer
  - lead
  - marketingqualifiedlead
  - salesqualifiedlead
  - opportunity
  - Kunde
- Stages of being a customer
  - Kunde
  - Kunde laufende Kündigung
  - Verlorener Kunde
  - Reaktivierter Kunde
- A certain type of customer is "Only service".
- A "Fürsprecher" is a fan or brand ambassador who may or may not be a customer.

There are a few more lifecycle stages but these are the most important ones. 

#### Current stage

The contact is currently in [condense]
  [if:[value:hubspot.owner["[value:contact.lifecyclestage]"]]]
    the `[value:hubspot.owner["[value:contact.lifecyclestage]"]]`
  [if-else]
    an unknown ([if:HubspotHints=true]"lifecyclestage" is missing in the HubSpot contact.[if-end])
  [if-end]
[condense-end] lifecycle stage.
[condense]
  [if:lead.hs_v2_date_entered_1076170605] // Muss dynamisch sein
    They are in this stage since [value:contact.hs_v2_date_entered_1076170605].
  [if-end]
[condense-end]

The company is currently in the "[value:company.lifecyclestage]" lifecycle stage.

#### Last sales interaction

The contact has been qualified by marketing, depending on interaction patterns and an automatic scoring.

[condense]
  [if:value:contact.lifecyclestage="lead"]
    // Raphael: 
  [if-elif:contact.lifecyclestage="Marketing-Qualified-Lead"]
    The contact has somehow interacted with your website or support content.
  [if-elif:contact.lifecyclestage="Sales-Qualified-Lead"]
    The contact has been contacted by the Sales Manager.
  [if-elif:contact.lifecyclestage="Opportunity"]
    The contact has been classified as a potential deal due to detected interest in our services.
  [if-elif:contact.lifecyclestage="Customer"]
  
  [if-else]
  
  [if-end]
[condense-end]

#### Next best action

In general, the higher the lifecycle stage, the more important it is for us to interact with the lead.  

[condense]
  [if:value:contact.lifecyclestage="lead"]
    
  [if-elif:contact.lifecyclestage="Marketing-Qualified-Lead"]
    
  [if-elif:contact.lifecyclestage="Sales-Qualified-Lead"]
    
  [if-elif:contact.lifecyclestage="Opportunity"]
    Sales Manager will likely send a formal or an informal offer / price indicator.
    Alternatively, Sales Manager will schedule a meeting (to discuss a price indication)
  [if-elif:contact.lifecyclestage="Customer"]
  
  [if-else]
  
  [if-end]
[condense-end]

[condense]
  [if:value:contact.lifecyclestage="Fürsprecher"|contact.lifecyclestage="Kunde"|contact.lifecyclestage="Kunde laufende kündigung"|contact.lifecyclestage="Verlorener kunde"|contact.lifecyclestage="Reaktivierter kunde"|contact.lifecyclestage="Only service"]
    Since the contact is in the lifecycle stage of customer or something similar, the contact needs to be treated with care, double checking the available information to ensure that communication is in line with previous interactions. 
  [if-end]
[condense-end]

[condense]
  [if:value:contact.lifecyclestage="Kunde laufende kündigung"]
    Since the contact is a customer but wants to quit their contract with us, the contact should not be contacted for another topic, or at least this needs to be checked thouroughly. 
  [if-end]
[condense-end]

[condense]
  [if:value:contact.lifecyclestage="Fürsprecher"]
    
  [if-elif:contact.lifecyclestage="Kunde"]
    
  [if-elif:contact.lifecyclestage="Kunde laufende kündigung"]
    
  [if-elif:contact.lifecyclestage="Verlorener kunde"]
    
  [if-elif:contact.lifecyclestage="Reaktivierter kunde"]
    
  [if-elif:contact.lifecyclestage="Only service"]
    
  [if-end]
[condense-end]

[condense]
  [if:lead.hs_lifecyclestage_lead_date&hs_lifecyclestage_customer_date]
    The contact is a lead since [value:contact.hs_lifecyclestage_lead_date date="%d.%m.%Y"], but this is not relevant, because they are a customer as well.  
    The contact is a customer since [value:contact.hs_lifecyclestage_customer_date date="%d.%m.%Y"].
  [if-elif:hs_lifecyclestage_lead_date]
    The contact is a lead since [value:contact.hs_lifecyclestage_lead_date date="%d.%m.%Y"].  
    We dont know since when the contact is a customer (nor whether they are).
  [if-elif:hs_lifecyclestage_customer_date]
    The contact is a customer since [value:contact.hs_lifecyclestage_customer_date date="%d.%m.%Y"].  
    We dont know since when the contact is a lead (nor whether they are).
  [if-else]
    We dont know whether (and if: since when) the contact is a lead or a customer.
  [if-end]
[condense-end]

#### Time in lifecycle stages

[condense]
  [if:contact.hs_time_between_contact_creation_and_deal_close]
    The deal was closed [value:contact.hs_time_between_contact_creation_and_deal_close time="%Y %m %d %H %M %S"] after the contact has been created in HubSpot.
  [if-end]
[condense-end]

- hs_time_to_first_engagement: [value:contact.hs_time_to_first_engagement time="%Y %m %d %H %M %S"]
- hs_time_to_move_from_lead_to_customer: [value:contact.hs_time_to_move_from_lead_to_customer time="%Y %m %d %H %M %S"]
- hs_time_to_move_from_marketingqualifiedlead_to_customer: [value:contact.hs_time_to_move_from_marketingqualifiedlead_to_customer time="%Y %m %d %H %M %S"]
- hs_time_to_move_from_opportunity_to_customer: [value:contact.hs_time_to_move_from_opportunity_to_customer time="%Y %m %d %H %M %S"]
- hs_time_to_move_from_salesqualifiedlead_to_customer: [value:contact.hs_time_to_move_from_salesqualifiedlead_to_customer time="%Y %m %d %H %M %S"]
- hs_time_to_move_from_subscriber_to_customer: [value:contact.hs_time_to_move_from_subscriber_to_customer time="%Y %m %d %H %M %S"]

- hs_v2_cumulative_time_in_customer: [value:contact.hs_v2_cumulative_time_in_customer time="%Y %m %d %H %M %S"]
- hs_v2_cumulative_time_in_lead: [value:contact.hs_v2_cumulative_time_in_lead]

---

## Engagement

We automatically detect usage on our digital properties. 
This section contains the signals we have detected (which probably are incomplete).

### Emails

#### General

The last time we sent an email to the company was on [value:company.hs_last_logged_outgoing_email_date date="%d.%m.%Y"]

#### Sales

The last time the contact opened a sales email was on [value:contact.hs_sales_email_last_opened date="%d.%m.%Y"]. 
The last time they replied to a sales email was on [value:contact.hs_sales_email_last_replied date="%d.%m.%Y"].

The last time someone from the company replied to a sales email was on [value:company.hs_sales_email_last_replied date="%d.%m.%Y"].

#### Marketing

##### Total numbers

So far, the contact received [value:contact.hs_email_delivered] marketing emails from us.  
They opened [value:contact.hs_email_open] and replied to [value:contact.hs_email_replied].  
Since then, they received [value:contact.hs_email_sends_since_last_engagement] marketing emails. 

##### Optimal timing

The best time to send the contact a marketing email is [value:contact.hs_email_optimal_send_day_of_week]s around [value:contact.hs_email_optimal_send_time_of_day].

##### Event dates

They first received an email on [value:contact.hs_email_first_send_date date="%d.%m.%Y"]. 
Last one was on [value:contact.hs_email_last_send_date date="%d.%m.%Y"].

They first opened an email on [value:contact.hs_email_first_open_date date="%d.%m.%Y"]. 
Last open was on [value:contact.hs_email_last_open_date date="%d.%m.%Y"].

Their first reply was on [value:contact.hs_email_first_reply_date date="%d.%m.%Y"]. 
Last open was on [value:contact.hs_email_last_reply_date date="%d.%m.%Y"].

##### Last email

The name of the last email the contact received was "[value:contact.hs_email_last_email_name]".  
// Andreas: Bedingten Text einfügen wenn dies die letzte Mail war

### Website

The contact has visited our website [value:contact.hs_analytics_num_visits] times.  
Their average visit-to-page-view ratio is 1:[value:contact.hs_analytics_average_page_views].  
Throughout their [value:contact.hs_analytics_num_page_views] page views, they have viewed [value:contact.seitenaufruf_produktseiten] product pages. 

The first page the contact has ever visited is [this URL]([value:contact.hs_analytics_first_url]), which happened on [value:contact.hs_analytics_first_visit_timestamp date="%d.%m.%Y"].
The last page the contact has visited so far was [this URL]([value:contact.hs_analytics_last_url]), referred to us via `[value:contact.hs_analytics_last_referrer]` on [value:contact.hs_analytics_last_visit_timestamp date="%d.%m.%Y"].

The first time someone from the company has visited our website was on [value:company.hs_analytics_first_visit_timestamp date="%d.%m.%Y"] (or [value:company.hs_analytics_first_timestamp date="%d.%m.%Y"]). // Welches Feld ist richtig?

The last time someone from the company has visited our website was on [value:company.hs_analytics_last_timestamp date="%d.%m.%Y"] (or [value:company.hs_analytics_last_visit_timestamp date="%d.%m.%Y"]). // Welches Feld ist richtig?

Contacts from the company have visited our website [value:company.hs_analytics_num_visits] times, amounting to [value:company.hs_analytics_num_page_views] page views.

Some additional analytics data of the contact:  
- Hubspot analytics source: `[value:contact.hs_analytics_source]`
- Hubspot analytics source data 1: `[value:contact.hs_analytics_source_data_1]`
- Hubspot analytics source data 2: `[value:contact.hs_analytics_source_data_2]`

Some additional analytics data of the company:  
- hs_analytics_latest_source: `[value:company.hs_analytics_latest_source]`
- hs_analytics_latest_source_data_1: `[value:company.hs_analytics_latest_source_data_1]`
- hs_analytics_latest_source_data_2: `[value:company.hs_analytics_latest_source_data_2]`
- hs_analytics_latest_source_timestamp: [value:company.hs_analytics_latest_source_timestamp date="%d.%m.%Y"]

### Meetings

The last meeting the contact requested was `[value:contact.engagements_last_meeting_booked_campaign]` via `[value:contact.engagements_last_meeting_booked_source]`.
The last time a meeting was booked by the company was on [value:company.engagements_last_meeting_booked date="%d.%m.%Y"].

The last time someone from the company had a meeting with us was on [value:company.hs_latest_meeting_activity date="%d.%m.%Y"].
The meeting was booked on [value:company.hs_last_booked_meeting_date date="%d.%m.%Y"].

The last time a call with the company happened was on [value:company.hs_last_logged_call_date date="%d.%m.%Y"].

### Forms

Users can fill out forms on our website. 

Our systems have generated this metric from watching our forms:  
`[value:contact.hs_calculated_form_submissions]`

### Social

We heve detected these clicks of the contact on our social media profiles:

- Broadcast: [value:contact.hs_social_num_broadcast_clicks]
- Facebook: [value:contact.hs_social_facebook_clicks]
- Google Plus: [value:contact.hs_social_google_plus_clicks]
- LinkedIn: [value:contact.hs_social_linkedin_clicks]
- X (formerly Twitter): [value:contact.hs_social_twitter_clicks]

### Activities

This indicated the latest activities with the contact. The more interactions with the lead in the past, the more important it is to stay in contact with the contact. 

The last sales activity with the contact was `[value:contact.hs_last_sales_activity_type]`. 
It happened on [value:contact.hs_last_sales_activity_timestamp date="%d.%m.%Y"].

- hs_latest_open_lead_date: [value:contact.hs_latest_open_lead_date date="%d.%m.%Y"]
- hs_latest_source_data_1: `[value:contact.hs_latest_source_data_1]`
- hs_latest_source_data_2: `[value:contact.hs_latest_source_data_2]`
- hs_latest_source_timestamp: [value:contact.hs_latest_source_timestamp date="%d.%m.%Y"]

### Outreach

Contacts can be put into sequences to automatically send them messages. This includes automatic emails sent or automatic reminder tasks to call the contact. 
Contacts are mostly in sequences after webinars they attended or if the Sales team is contacting new cold leads in an automated way.   

[condense]
  [if:contact.hs_sequences_is_enrolled]
    The contact is currently enrolled.
  [if-else]
    The contact is not enrolled currently.
  [if-end]
[condense-end]
The contact has actively enrolled in [value:contact.hs_sequences_actively_enrolled_count] HubSpot sequences.

---

## Scorings

We automatically generate scorings based on usage we have detected automatically.
These scorings may be out of touch with reality, but generally they are very helpful to quickly match our product portfolio with the actual needs of the contact.
Scoring is divided into fit and interaction. Fit is classified into A, B and C, where A is the best fit and C the worst. Interaction is classified into 1, 2 and 3, where 1 is the highest degree of interaction and 3 the lowest. 
Every contact has a scoring in the following areas: ESG, Climate, Supply Chain, and EUDR. These scorings range from A1 (best) to C3 (worst). Contacts with A1, A2 and B1 have the highest priority in sales outreach, contacts with C3 the lowest. 
A low scoring does not necessarily mean that the contact is not wortth contacting at all, but it gives a good general guidance.  

// Michael, Simone:
// Wie berechnet sich das Scoring?
// Welches Scoring ist relevanter, Contact oder Company?

### Scoring for individual hubs

Certain information classify contacts for a fit regarding certain hubs. VERSO is operating with the following three hubs: ESG Hub, Climate Hub, and Supply Chain Hub. 
The higher the following numbers (if available), the higher the score for the corresponding hub.

Linked to the VERSO Supply Chain Hub: 
- cbam_waren: [value:company.cbam_waren]
- anzahl_cbam_supplier: [value:company.anzahl_cbam_supplier]
- anzahl_cbam_waren: [value:company.anzahl_cbam_waren]
- anzahl_eudr_produkte__eudr_check_: [value:company.anzahl_eudr_produkte__eudr_check_]
- anzahl_eudr_supplier__eudr_check_: [value:company.anzahl_eudr_supplier__eudr_check_]
- - eudr_pflichtig: [value:company.eudr_pflichtig]
- eudr_rolle__eudr_check_: [value:company.eudr_rolle__eudr_check_]
- eudr_unternehmensgro_e__eudr_check_: [value:company.eudr_unternehmensgro_e__eudr_check_]
- eudr_waren: [value:company.eudr_waren]
- esg_readiness_lieferkette: [value:company.esg_readiness_lieferkette]
 
Linked to the VERSO ESG Hub:
- csrd_berichtspflicht__typen_nach_readiness_check_: [value:company.csrd_berichtspflicht__typen_nach_readiness_check_]
- esg_level_sc: [value:company.esg_level_sc]

### Overall

// Thresholds
// Hier müssen die 4 Schwellenwerte rein
// Andreas: Recherchiere Kombiscores
// Andreas: evtl Text aus Scorings hier einfügen, wenn relevant

- lead_score___neu_202208: [value:contact.lead_score___neu_202208] // Evtl veraltet

### Product Fit

- fit_score_eudr_202507_schwellenwert: [value:contact.fit_score_eudr_202507_schwellenwert]

### Monetisation

- hs_analytics_revenue: [value:contact.hs_analytics_revenue]

### Communication

Their Messaging Engagement Score is [value:contact.hs_messaging_engagement_score].

## History

### Tasks

[value:tasks failure="There are no open tasks for the contact."]
