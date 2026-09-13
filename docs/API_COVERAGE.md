# API/UI Coverage

| API area       | UI                                                            |
| -------------- | ------------------------------------------------------------- |
| Authentication | Login, registration, logout                                   |
| User profile   | View session, update name, change password                    |
| Organisations  | Current org details, edit, delete, members, limits, ownership |
| Numbers        | Full supported CRUD                                           |
| SIP Users      | Full supported CRUD + password rotation                       |
| SIP Gateways   | Full supported CRUD + test                                    |
| Calls          | List/view/originate/hangup                                    |
| Recordings     | List/view/play/download/delete                                |
| Applications   | Full supported CRUD + visual flow builder                     |
| Queues         | Full supported CRUD + stats/members/tiers                     |
| Agents         | Full supported CRUD + live status                             |
| SMS            | Send/list/view                                                |
| SMS Credential | Create/view/edit/delete                                       |
| Webhooks       | Full supported CRUD + rotate secret + deliveries/retry        |
| API Keys       | Create/list/view/revoke + limits                              |
| Events         | Publish/test event                                            |

Operations not exposed by the API itself (for example editing a completed call or deleting an SMS record) are intentionally not invented in the UI.
