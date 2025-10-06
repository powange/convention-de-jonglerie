-- RenameIndex
ALTER TABLE `TicketingOptionReturnableItem` RENAME INDEX `OptionReturnableItem_optionId_idx` TO `TicketingOptionReturnableItem_optionId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOptionReturnableItem` RENAME INDEX `OptionReturnableItem_optionId_returnableItemId_key` TO `TicketingOptionReturnableItem_optionId_returnableItemId_key`;

-- RenameIndex
ALTER TABLE `TicketingOptionReturnableItem` RENAME INDEX `OptionReturnableItem_returnableItemId_idx` TO `TicketingOptionReturnableItem_returnableItemId_idx`;
