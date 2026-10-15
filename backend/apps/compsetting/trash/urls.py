"""URLs for Settings → Trash (included by ``apps.compsetting.urls``)."""

from django.urls import path

from .views import (
    TrashEntryView,
    TrashListView,
    TrashPurgeExpiredView,
    TrashRestoreView,
    TrashSummaryView,
)

app_name = 'trash'

urlpatterns = [
    path('', TrashListView.as_view(), name='list'),
    path('summary/', TrashSummaryView.as_view(), name='summary'),
    path('purge-expired/', TrashPurgeExpiredView.as_view(), name='purge-expired'),
    # Keep the restore route above the bare entry route so it always wins.
    path('<str:type_key>/<uuid:entry_id>/restore/', TrashRestoreView.as_view(), name='restore'),
    path('<str:type_key>/<uuid:entry_id>/dependencies/', TrashEntryView.as_view(), name='dependencies'),
    path('<str:type_key>/<uuid:entry_id>/', TrashEntryView.as_view(), name='entry'),
]
