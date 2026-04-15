-- Character presence and chat realtime transport.
-- Apply this in Supabase SQL editor or convert it into your migration flow.

alter table public."Characters"
add column if not exists status text not null default 'offline';

update public."Characters"
set status = 'offline'
where status is null;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'characters_status_check'
	) then
		alter table public."Characters"
		add constraint characters_status_check
		check (status in ('online', 'away', 'dnd', 'offline'));
	end if;
end;
$$;

create or replace function public.broadcast_message_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	target_chat_id uuid;
	topic_event text;
	member_user_id uuid;
begin
	target_chat_id := coalesce(NEW.chat, OLD.chat);
	topic_event := case
		when TG_OP = 'INSERT' then 'message.created'
		when TG_OP = 'UPDATE' then 'message.updated'
		else 'message.deleted'
	end;

	perform realtime.broadcast_changes(
		format('chat:%s', target_chat_id),
		topic_event,
		TG_OP,
		TG_TABLE_NAME,
		TG_TABLE_SCHEMA,
		NEW,
		OLD
	);

	for member_user_id in
		select distinct "userId"
		from public."ChatsMembers"
		where "chatId" = target_chat_id
	loop
		perform realtime.broadcast_changes(
			format('user:%s:chat-list', member_user_id),
			'chat-list.changed',
			TG_OP,
			TG_TABLE_NAME,
			TG_TABLE_SCHEMA,
			NEW,
			OLD
		);
	end loop;

	return null;
end;
$$;

create or replace function public.broadcast_chat_list_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	target_chat_id uuid;
	recipient_user_id uuid;
begin
	target_chat_id := case
		when TG_TABLE_NAME = 'Messages' then coalesce(NEW.chat, OLD.chat)
		when TG_TABLE_NAME = 'ChatsMembers' then coalesce(NEW."chatId", OLD."chatId")
		else coalesce(NEW.id, OLD.id)
	end;

	for recipient_user_id in
		select distinct member_user_id
		from (
			select "userId" as member_user_id
			from public."ChatsMembers"
			where "chatId" = target_chat_id

			union all

			select NEW."userId"
			where TG_TABLE_NAME = 'ChatsMembers' and NEW."userId" is not null

			union all

			select OLD."userId"
			where TG_TABLE_NAME = 'ChatsMembers' and OLD."userId" is not null

			union all

			select NEW."ownerId"
			where TG_TABLE_NAME = 'Chats' and NEW."ownerId" is not null

			union all

			select OLD."ownerId"
			where TG_TABLE_NAME = 'Chats' and OLD."ownerId" is not null
		) recipients
		where member_user_id is not null
	loop
		perform realtime.broadcast_changes(
			format('user:%s:chat-list', recipient_user_id),
			'chat-list.changed',
			TG_OP,
			TG_TABLE_NAME,
			TG_TABLE_SCHEMA,
			NEW,
			OLD
		);
	end loop;

	return null;
end;
$$;

drop trigger if exists handle_message_broadcast on public."Messages";
create trigger handle_message_broadcast
after insert or update or delete
on public."Messages"
for each row
execute function public.broadcast_message_changes();

drop trigger if exists handle_message_chat_list_broadcast on public."Messages";
create trigger handle_message_chat_list_broadcast
after insert or update or delete
on public."Messages"
for each row
execute function public.broadcast_chat_list_changes();

drop trigger if exists handle_chat_broadcast on public."Chats";
create trigger handle_chat_broadcast
after insert or update or delete
on public."Chats"
for each row
execute function public.broadcast_chat_list_changes();

drop trigger if exists handle_chat_members_broadcast on public."ChatsMembers";
create trigger handle_chat_members_broadcast
after insert or update or delete
on public."ChatsMembers"
for each row
execute function public.broadcast_chat_list_changes();

grant usage on schema realtime to authenticated;
grant select on realtime.messages to authenticated;
alter table realtime.messages enable row level security;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'realtime'
			and tablename = 'messages'
			and policyname = 'Authenticated users can receive chat broadcasts'
	) then
		create policy "Authenticated users can receive chat broadcasts"
		on realtime.messages
		for select
		to authenticated
		using (
			(
				split_part(realtime.topic(), ':', 1) = 'chat'
				and exists (
					select 1
					from public."ChatsMembers" member
					where member."chatId"::text = split_part(realtime.topic(), ':', 2)
						and member."userId" = auth.uid()
				)
			)
			or (
				split_part(realtime.topic(), ':', 1) = 'user'
				and split_part(realtime.topic(), ':', 2) = auth.uid()::text
				and split_part(realtime.topic(), ':', 3) = 'chat-list'
			)
		);
	end if;
end;
$$;
