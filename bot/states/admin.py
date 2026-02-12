from aiogram.fsm.state import State, StatesGroup


class DeclineCoach(StatesGroup):
    enter_reason = State()
