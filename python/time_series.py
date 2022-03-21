from io import StringIO
import csv
import sys
import json

def main(arg1):
    scsv = arg1

    f = StringIO(scsv)
    reader = csv.reader(f, delimiter=',')
    input = []
    for row in reader:
        input.append(row)

    if not(input[0][0] == 'Province/State' and input[0][1] == 'Country/Region' and input[0][2] == 'Lat' and input[0][3] == 'Long' and len(input) > 1):
        print("error")
        sys.stdout.flush()
    else:
        output = []
        for countryIndex in range(1, len(input)):
            province = input[countryIndex][0]
            country = input[countryIndex][1]
            for dateIndex in range(4, len(input[0])):
                date = input[0][dateIndex]
                val = input[countryIndex][dateIndex]
                output.append({"province":province, "country": country, "date": date, "val": val})
        
        print(json.dumps(output))
        sys.stdout.flush()


if __name__ == "__main__":
    main(sys.argv[1])