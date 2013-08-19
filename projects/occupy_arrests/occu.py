#!/usr/bin/python3.2
"""
 this script retrieves data on arrests associated with the Occupy movement from a particular website (occupyarrests.com),
 looks up the geographical coordinates of the arrest locations in a USgov shapefile,
 and outputs a csv file with the added spatial data.
 developed for data visualization.

 necessary to run this script:
  - Python 3.2
  - internet connection
  - shapefile.py module in same folder as script (available at http://code.google.com/p/pyshp/)
  - FIPS directory: shapefile with municipality locations
         (available at http://www.nws.noaa.gov/geodata/catalog/national/html/cities.htm)
  - Beautiful Soup ($ [python3.2 -m] easy_install beautifulsoup4)
 
 shapefile filename: 'ci01jn11/ci01jn11'

$ python3.2 occu.py "ci01jn11/ci01jn11" "occupyarrests.csv"
 
"""

import sys, re, csv, urllib.request, shapefile
from bs4 import BeautifulSoup

def get_data():
  arrestHTML = urllib.request.urlopen("http://stpeteforpeace.org/occupyarrests.sources.html").read()
  arrestSoup = BeautifulSoup(arrestHTML)
  data = arrestSoup.col.find_next_sibling('tbody').find_all('tr')
  date = []
  loc = []
  count = []
  event = []
  source = []
  ausgabe = [date, loc, count, event, source]
  for i, child in enumerate(data):
    if i > 0:   # get rid of title row
      for j, cell in enumerate(child('td')):
        if cell.a:
          ausgabe[j].append(cell.a['href'])
        elif cell.string:
          ausgabe[j].append(cell.string)
        else:
          ausgabe[j].append(cell.get_text())
  return arrestSoup, data, ausgabe[0], ausgabe[1], ausgabe[2], ausgabe[3], ausgabe[4]

      
def get_records(filename):
  records = shapefile.Reader(filename).records()
  return records


def loc_refine(loc): # arrrrg
  state = []
  loc2 = loc[:]
  for i in range(len(loc)):
    if loc2 == "Davis":
      print(i, loc2[i])
    loc2[i] = re.sub(r'Ft[.]', r'Fort', str(loc2[i])) # expand this silly 'Fort' abbreviation
    loc2[i] = re.sub(r'Seatle', r'Seattle', str(loc2[i])) # fix this misspelling
    loc2[i] = re.sub(r'Washinton', r'Washington', str(loc2[i]))
    loc2[i] = re.sub(r'Franciso', r'Francisco', str(loc2[i])) # seriously, c'mon
    state.append(re.findall(r',*\s(\w[.]*\w[.]*)$', str(loc2[i]))) # if city name ends with state name: put in separate list
    if state[len(state)-1]:
      state[len(state)-1] = re.sub(r'[.\[\]\']', r'', str(state[len(state)-1]))
    loc2[i] = re.sub(r',*\s\w[.]*\w[.]*$', r'', str(loc2[i])) # get rid of state name
    loc2[i] = str(loc2[i]).rstrip() # no trailing whitespace
    # sub in more well-known locales (California towns seem to produce a lot of trouble for this shapefile)
    if loc2[i] == 'Isla Vista':
      loc2[i] = 'Santa Barbara'
    if loc2[i] == 'Coachella Valley':
      loc2[i] = 'Palm Desert'
    if loc2[i] == 'San Marino':
      loc2[i] = 'Pasadena'
    if loc2[i] == 'Albany' and state[i] == 'CA':
      loc2[i] = 'Berkeley'
    if loc2[i] == 'Century City':
      loc2[i] = 'Los Angeles'
  return loc2, state


def FIPS_lookup(loc, state, records):
  locC = [name.upper() for name in loc]
  FIPSdict = {}
  #debug = csv.writer(open('FIPS_cities_states.csv', 'w', newline = ''), delimiter = ',')
  for j in range(len(locC)):
    if locC[j] == 'NONE':
      print(j, locC[j])
    if locC[j] not in FIPSdict:
      FIPSdict[locC[j]] = {}
      recs = []
      for i in range(len(records)):
        # annoying, specific population corrections
        if records[i][9] == 'ATLANTA' and records[i][10] == 'GA':
          records[i][8] = '486411'
        if records[i][9] == 'NEW YORK' and records[i][10] == 'NY':
          records[i][8] = '8008278'
        if records[i][9] == 'PHILADELPHIA' and records[i][10] == 'PA':
          records[i][8] = '1209052'
        if locC[j] in records[i][9]:
          FIPSdict[locC[j]][records[i][10]] = [i, records[i]]
          recs.append([i, records[i]])
        FIPSdict[locC[j]]['all'] = recs
    if len(FIPSdict[locC[j]]['all'])==0:
      print("Error: no FIPS directory entry for", locC[j]) # -> you must go tinker with loc_refine to deal with people's typos
  #print(FIPSdict['PORTLAND'])
  return FIPSdict


"""useful workspace loops for FIPS lookup debugging.

for site in FIPSdict['CITY THAT IT GETS WRONG']:
  print(site) # or: site[1][10]
  print()

for site in FIPSdict['ALBANY']:
  print(site) # or: site[1][10]
  print()
  
for key in FIPSdict:
  print (key, len(FIPSdict[key]))  
  for i in range(len(FIPSdict[key])):
     print (' ', FIPSdict[key][i][1][10])
"""

# dumb function - given various cities with the same name, selects the city with highest population
# (unless explicitly told not to via exceptions at the bottom)

def FIPS_population_rank(FIPSdict):
  FIPS2 = {}
  for key in FIPSdict:
    FIPS2[key] = FIPSdict[key]['all'][:]
    if len(FIPS2[key]) > 1:
      pop = []
      for i in range(len(FIPS2[key])):
        try:
          pop.append(int(FIPS2[key][i][1][8]))
        except ValueError:
          pop.append(0)
      index = pop.index(max(pop))
      maxPop = FIPS2[key][index]
      while not re.search(key + r'$', maxPop[1][9]): # this makes sure the name has the right *ending* - 'lincoln' vs 'lincoln park'
        del pop[index]
        del FIPS2[key][index]
        if pop:
          newInd = pop.index(max(pop))
          maxPop = FIPS2[key][newInd]
        #else:
          #print (FIPSdict[key], maxPop[1][8:11]) # uncomment to see printout of selected cities for hand-correction purposes
      FIPS2[key] = maxPop
    elif len(FIPS2[key]) == 1:
      FIPS2[key] = FIPS2[key][0]
    else:
      print("Error: no FIPS directory entry for", key) # these should have been flagged already by FIPS_lookup, but hey, just in case
  FIPS2['BURLINGTON'] = FIPSdict['BURLINGTON']['all'][22]
  FIPS2['BLOOMINGTON'] = FIPSdict['BLOOMINGTON']['all'][7]
  FIPS2['BEND'] = FIPSdict['BEND']['all'][21]
  #print(FIPSdict['PORTLAND'])
  FIPS2['PORTLAND'] = FIPSdict['PORTLAND']['all'][16]
  FIPS2['DARIEN'] = FIPSdict['DARIEN']['all'][4]
  return FIPS2


def data_to_csv(date, loc, count, event, source, state, FIPSdict, FIPS2, csvFilename):
  if not re.search(r'[.]csv$',csvFilename):
    csvFilename = csvFilename + ".csv"
  arrest_data = csv.writer(open(csvFilename, 'w', newline = ''), delimiter = ',')
  arrest_data.writerow(['date', 'loc', 'count', 'source', 'SFIPS', 'SFIPS', 'CFIPS', 'CFIPS', 'PLFIPS', 'GNIS-ID-maybe', 'unclear11', 'pop1990', 'pop2000', 'Name', 'State-abb', 'State', 'unclear17', 'unclear18', 'unclear19', 'unclear20', 'unclear21', 'unclear22', 'unclear23', 'unclear24', 'unclear25', 'Long', 'Lat'])
  for i in range(len(date)):
    d = str(date[i])
    l = str(loc[i])
    c = str(count[i])
    e = str(event[i])
    s = str(source[i])
    if state[i]:    # if there's a state available, we look up the corresponding city-state combo in FIPSdict
      record = FIPSdict[loc[i].upper()][state[i]][1]
    else:
      record = FIPS2[loc[i].upper()][1]
    arrest_data.writerow([d, l, c, s] + record)


def main():
  args = sys.argv[1:]

  if not args:
    args = ["ci01jn11/ci01jn11", "occupyarrests.csv"]
    #print ('usage: [--htmlWrite] shapefile outputCSVfilename')
    #sys.exit(1)

  html = False # optional htmlWrite flag saves a prettified local copy of the html code
  if args[0] == '--htmlWrite':
    html = True
    del args[0]

  soup, data, date, loc, count, event, source = get_data()
  print(loc[281])
  records = get_records(args[0])
  loc2, state = loc_refine(loc)
  FIPSdict = FIPS_lookup(loc2, state, records)
  FIPS2 = FIPS_population_rank(FIPSdict)
  data_to_csv(date, loc2, count, event, source, state, FIPSdict, FIPS2, args[1])
  if html:
    open('arrests.html','bw').write(soup.prettify())
  sys.exit(0)
  
if __name__ == '__main__':
  main()



