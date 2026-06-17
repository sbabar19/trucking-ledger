from rest_framework import serializers


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=200, trim_whitespace=True)
    pickup_location = serializers.CharField(max_length=200, trim_whitespace=True)
    dropoff_location = serializers.CharField(max_length=200, trim_whitespace=True)
    current_cycle_used = serializers.FloatField(min_value=0, max_value=70)
    current_coordinates = serializers.ListField(
        child=serializers.FloatField(),
        min_length=2,
        max_length=2,
        required=False,
    )
    pickup_coordinates = serializers.ListField(
        child=serializers.FloatField(),
        min_length=2,
        max_length=2,
        required=False,
    )
    dropoff_coordinates = serializers.ListField(
        child=serializers.FloatField(),
        min_length=2,
        max_length=2,
        required=False,
    )

    def validate(self, attrs):
        for field in ('current_location', 'pickup_location', 'dropoff_location'):
            if not attrs[field].strip():
                raise serializers.ValidationError({field: 'This field may not be blank.'})
        return attrs
