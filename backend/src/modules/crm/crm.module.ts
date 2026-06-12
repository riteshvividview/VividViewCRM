import { Module } from '@nestjs/common';
import { LeadsModule } from './leads/leads.module';
import { DealsModule } from './deals/deals.module';
import { ContactsModule } from './contacts/contacts.module';
import { CampaignsModule } from './campaigns/campaigns.module';

@Module({
  imports: [LeadsModule, DealsModule, ContactsModule, CampaignsModule],
})
export class CrmModule {}
