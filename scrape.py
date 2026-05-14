
import time
import schedule
import json
import re
import requests
from datetime import datetime

# Local
import timestamps as ts

hold = False
spanish_regex = r'\s?\/.+?(?=$| - (?:Dem|Rep)| \()'

last_version = {}
source_url = 'https://results.sos.ga.gov/cdn/results/Georgia/export-51226SpecialElection.json'

# Import latest version

timestamps = list(ts.list_timestamps())

timestamps.sort()

if timestamps:
    with open('data/' + timestamps[-1].strftime(ts.date_file_format), 'r') as f:
        last_version = json.load(f)

# Scrape and save

def job():
    global last_version
    global spanish_regex

    timestamp = datetime.now()

    response = requests.get(source_url)
    if response.status_code == 200:
        data = response.json()
        print('Scraped')

        # Clean to reduce filesize
        del data['electionDate']
        del data['results']['id']
        del data['results']['name']
        for ballotItem in data['results']['ballotItems']:
            del ballotItem['type']
            del ballotItem['voteFor']
            del ballotItem['precinctsParticipating']
            del ballotItem['precinctsReporting']
            del ballotItem['contestType']
            del ballotItem['rankedChoiceResults']

            # Strip Spanish translations in Gwinnett
            ballotItem['name'] = re.sub(spanish_regex, '', ballotItem['name'])

        for localResult in data['localResults']:
            del localResult['id']
            del localResult['reportingStatuses'] # /// This may need to go if we want to improve county reporting map
            for ballotItem in localResult['ballotItems']:
                del ballotItem['type']
                del ballotItem['voteFor']
                del ballotItem['contestType']
                del ballotItem['rankedChoiceResults']
                del ballotItem['precinctsParticipating']
                del ballotItem['precinctsReporting']

                # Strip Spanish translations in Gwinnett
                if 'Gwinnett' in localResult['name']:
                    ballotItem['name'] = re.sub(spanish_regex, '', ballotItem['name'])

                for ballotOption in ballotItem['ballotOptions']:
                    del ballotOption['politicalParty']
                    del ballotOption['groupResults']
                    for precinctResults in ballotOption['precinctResults']:
                        del precinctResults['isVirtual']
                        #del precinctResults['voteCount']
                        for groupResults in precinctResults['groupResults']:
                            del groupResults['isFromVirtualPrecinct']

                        precinctResults['groupResults'] = flattenGroupResults(precinctResults['groupResults'])

        # Save
        if not(last_version) or last_version != data:
            last_version = data
            f = timestamp.strftime(ts.date_file_format)
            with open(f'data/{f}', 'w') as file:
                json.dump(data, file)
            with open(f'latest.json', 'w') as file:
                json.dump(data, file)

    else:
        print(f'Error: Failed at {datetime.now()} with message: {response}, {response.reason}')

def flattenGroupResults(groupResults):
    return dict([(gr['groupName'], gr['voteCount'] if gr['voteCount'] != None else -1) for gr in groupResults])

# Hold until a minute divisible by 5 arises

if hold:
    n = datetime.now()
    g = datetime(n.year, n.month, n.day, n.hour, 5 - (n.minute % 5), n.second)
    s = max((g - n).seconds, 0)
    time.sleep(s)

job()

# Schedule

#schedule.every(5).minutes.do(job)

#while True:
#    schedule.run_pending()
#    time.sleep(1)