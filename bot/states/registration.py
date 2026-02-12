from aiogram.fsm.state import State, StatesGroup


class AthleteRegistration(StatesGroup):
    full_name = State()
    date_of_birth = State()
    gender = State()
    weight_category = State()
    current_weight = State()
    belt = State()
    country = State()
    country_custom = State()
    city = State()
    club = State()
    photo = State()


class CoachRegistration(StatesGroup):
    full_name = State()
    date_of_birth = State()
    gender = State()
    country = State()
    country_custom = State()
    city = State()
    club = State()
    qualification = State()
    photo = State()
