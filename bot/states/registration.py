from aiogram.fsm.state import State, StatesGroup


class AthleteRegistration(StatesGroup):
    full_name = State()
    date_of_birth = State()
    gender = State()
    weight_category = State()
    current_weight = State()
    sport_rank = State()
    city = State()
    city_custom = State()
    club = State()
    photo = State()


class CoachRegistration(StatesGroup):
    full_name = State()
    date_of_birth = State()
    gender = State()
    sport_rank = State()
    city = State()
    city_custom = State()
    club = State()
    photo = State()
