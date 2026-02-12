from aiogram.fsm.state import State, StatesGroup


class EnterAthletes(StatesGroup):
    select_athletes = State()
    select_age_category = State()
    confirm = State()
