from io import StringIO
import csv
import sys
import json

def main(arg1):
    scsv = arg1

    try:
        f = StringIO(scsv)
        reader = csv.reader(f, delimiter=',')
        output = []
        for row in reader:
            if row[0] != "FIPS":
                row_dict = {}
                # deal with empty string
                number_col = [0, 5, 6, 7, 8, 9, 10, 12, 13]
                for col_num in number_col:
                    if row[col_num] == "":
                        row[col_num] = 0

                output.append({
                    "Province_State": row[2],
                    "Country_Region": row[3],
                    "Last_Update": row[4],
                    "Confirmed": int(row[7]),
                    "Deaths": int(row[8]),
                    "Recovered": int(row[9]),
                    "Active": int(row[10]),
                    "Combined_Key": row[11],
                    "date": row[4].split(" ")[0]
                    })
        if output == []:
            print("error")
        else:
            print(json.dumps(output))
        sys.stdout.flush()
    except:
        print("error")
        sys.stdout.flush()


if __name__ == "__main__":
    main(sys.argv[1])