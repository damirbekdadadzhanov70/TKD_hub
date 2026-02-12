from aiogram.fsm.state import State, StatesGroup


class AddTournament(StatesGroup):
    name = State()
    description = State()
    start_date = State()
    end_date = State()
    city = State()
    country = State()
    venue = State()
    age_categories = State()
    weight_categories = State()
    entry_fee = State()
    currency = State()
    registration_deadline = State()
    importance_level = State()
    confirm = State()


class EditTournament(StatesGroup):
    select_tournament = State()
    select_field = State()
    enter_value = State()


class DeleteTournament(StatesGroup):
    select_tournament = State()
    confirm = State()
